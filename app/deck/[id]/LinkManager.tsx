"use client";

import { useEffect, useState } from "react";

type LinkRow = { id: string; slug: string; label: string; sessions: number };

export default function LinkManager({
  deckId,
  initialLinks,
}: {
  deckId: string;
  initialLinks: LinkRow[];
}) {
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, label: label.trim() || "Untitled link" }),
      });
      if (!res.ok) throw new Error("Failed");
      const link = await res.json();
      setLinks((l) => [{ ...link, sessions: 0 }, ...l]);
      setLabel("");
    } catch {
      // keep it simple; a failed create just doesn't add a row
    } finally {
      setCreating(false);
    }
  };

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/v/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1600);
    } catch {
      // clipboard blocked, ignore
    }
  };

  return (
    <div className="card">
      <h2 className="section-title">Tracked links</h2>
      <div className="link-form">
        <input
          className="input"
          placeholder="Who is this for? e.g. Sequoia, warm intro, Twitter..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !creating && create()}
        />
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? "..." : "New link"}
        </button>
      </div>

      {links.length === 0 ? (
        <p className="hint">Create a link per recipient so you can tell who read what.</p>
      ) : (
        <div className="rows">
          {links.map((l) => (
            <div key={l.id} className="row link-row">
              <div className="item">
                <div className="item-title">{l.label}</div>
                <div className="url">
                  {origin}/v/{l.slug}
                </div>
              </div>
              <div className="link-actions">
                <span className="chip">
                  {l.sessions} view{l.sessions === 1 ? "" : "s"}
                </span>
                <button className="btn btn-ghost" onClick={() => copy(l.slug)}>
                  {copied === l.slug ? "Copied" : "Copy"}
                </button>
                <a className="btn btn-ghost" href={`/v/${l.slug}`} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
