import Link from "next/link";
import { cookies } from "next/headers";
import { listDecksByOwner } from "@/lib/db";
import { fmtAgo } from "@/lib/format";
import Uploader from "./Uploader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  const owner = jar.get("dp_owner")?.value ?? "";
  const decks = owner ? await listDecksByOwner(owner) : [];

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          DeckPeek
        </div>
        <span className="chip">open source pitch-deck analytics</span>
      </div>

      <div className="shell">
        <section className="section">
          <h1 className="hero-title">See how they actually read your deck.</h1>
          <p className="lead">
            Upload a deck, share a tracked link, and watch which slides they lingered on,
            where they dropped off, whether they reached your ask, and if they came back.
          </p>
        </section>

        <Uploader />

        <div style={{ marginTop: 40 }}>
          <h2 className="section-title">Your decks</h2>
          {decks.length === 0 ? (
            <div className="empty">
              No decks yet. Drop a PDF above to create your first tracked link.
            </div>
          ) : (
            <div className="card row-list">
              {decks.map((d) => (
                <Link key={d.id} href={`/deck/${d.id}`} className="row deck-row">
                  <div className="item">
                    <div className="item-title">{d.title}</div>
                    <div className="item-sub">
                      {d.num_pages} slides &middot; created {fmtAgo(d.created_at)}
                    </div>
                  </div>
                  <span className="chip end">
                    {d.views} view{d.views === 1 ? "" : "s"}
                  </span>
                  <span className="faint" style={{ fontSize: 18 }}>
                    &rsaquo;
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="foot">DeckPeek &middot; MIT licensed &middot; your decks stay on your own server</p>
      </div>
    </>
  );
}
