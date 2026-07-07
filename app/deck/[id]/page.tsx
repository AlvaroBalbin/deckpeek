import Link from "next/link";
import { cookies } from "next/headers";
import { deckAnalytics, getDeck, listLinks } from "@/lib/db";
import { fmtAgo, fmtDuration } from "@/lib/format";
import LinkManager from "./LinkManager";

export const dynamic = "force-dynamic";

export default async function DeckDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deck = await getDeck(id);
  const jar = await cookies();
  const owner = jar.get("dp_owner")?.value ?? "";

  if (!deck) {
    return (
      <Shell>
        <div className="empty">Deck not found.</div>
      </Shell>
    );
  }
  if (deck.owner_token !== owner) {
    return (
      <Shell>
        <div className="empty">
          This deck belongs to another owner. Only its creator can see the analytics.
        </div>
      </Shell>
    );
  }

  const [analytics, links] = await Promise.all([deckAnalytics(deck), listLinks(deck.id)]);
  const { slides, sessions, totalSessions, totalMs, reopens, askPage } = analytics;

  const avgPerView = totalSessions ? Math.round(totalMs / totalSessions) : 0;
  const reachedAsk = sessions.filter((s) => s.reachedAsk).length;
  const reachedAskPct = totalSessions ? Math.round((reachedAsk / totalSessions) * 100) : 0;
  const maxAvg = Math.max(1, ...slides.map((s) => s.avgMs));
  const hottest = slides.reduce((a, b) => (b.avgMs > a.avgMs ? b : a), slides[0]);

  return (
    <Shell>
      <div className="section">
        <Link href="/" className="back">
          &lsaquo; All decks
        </Link>
        <h1 className="page-title">{deck.title}</h1>
        <div className="page-sub">
          {deck.num_pages} slides &middot; the ask is slide {askPage}
        </div>
      </div>

      <div className="stat-row section">
        <Stat label="Views" value={String(totalSessions)} />
        <Stat label="Total time" value={fmtDuration(totalMs)} />
        <Stat label="Avg / view" value={fmtDuration(avgPerView)} />
        <Stat
          label="Reached the ask"
          value={`${reachedAskPct}%`}
          sub={`${reachedAsk} of ${totalSessions}`}
        />
        <Stat label="Re-opens" value={String(reopens)} />
      </div>

      <div className="section">
        <LinkManager deckId={deck.id} initialLinks={links} />
      </div>

      <div className="card section">
        <h2 className="section-title">Attention per slide (avg time a viewer spent)</h2>
        {totalSessions === 0 ? (
          <p className="hint">No views yet. Share a link above, then reload this page.</p>
        ) : (
          <div className="heatmap">
            {slides.map((s) => {
              const pct = Math.round((s.avgMs / maxAvg) * 100);
              const isHot = s.page === hottest.page && s.avgMs > 0;
              const isAsk = s.page === askPage;
              return (
                <div className="heat-row" key={s.page}>
                  <span className="pageno">
                    {s.page}
                    {isAsk ? " *" : ""}
                  </span>
                  <div className="heat-track">
                    <div
                      className="heat-fill"
                      style={{
                        width: `${Math.max(pct, s.avgMs > 0 ? 3 : 0)}%`,
                        background: isHot
                          ? "linear-gradient(90deg, var(--warn), var(--hot))"
                          : "linear-gradient(90deg, var(--bar-a), var(--bar-b))",
                      }}
                    />
                  </div>
                  <span className="time">{s.avgMs > 0 ? fmtDuration(s.avgMs) : "-"}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="note">
          * marks your ask slide. Warm bar = the slide that held attention longest.
        </p>
      </div>

      <div className="card">
        <h2 className="section-title">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="hint">Nobody has opened a link yet.</p>
        ) : (
          <div className="rows">
            {sessions.map((s) => (
              <div key={s.id} className="row session-row">
                <div className="item">
                  <div className="item-title">{s.label}</div>
                  <div className="item-sub">
                    {fmtAgo(s.started_at)} &middot; got to slide {s.max_page}/{deck.num_pages}{" "}
                    &middot; {s.max_scroll_pct}% scrolled
                  </div>
                </div>
                <span className="mono muted end" style={{ fontSize: 13 }}>
                  {fmtDuration(s.totalMs)}
                </span>
                <span className={`end chip${s.reachedAsk ? " chip-good" : ""}`}>
                  {s.reachedAsk ? "reached ask" : "no ask"}
                </span>
                <span className={`end chip${s.completed ? " chip-accent" : ""}`}>
                  {s.completed ? "finished" : "dropped"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="topbar">
        <Link href="/" className="brand">
          <span className="dot" />
          DeckPeek
        </Link>
        <span className="chip">dashboard</span>
      </div>
      <div className="shell">{children}</div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
