import { createClient, type Client, type InArgs } from "@libsql/client";
import { existsSync, mkdirSync } from "node:fs";
import { randId } from "./ids";

const DB_URL = process.env.DECKPEEK_DB_URL ?? "file:data/deckpeek.db";

if (DB_URL.startsWith("file:") && !existsSync("data")) {
  mkdirSync("data", { recursive: true });
}

let _client: Client | null = null;
let _ready: Promise<void> | null = null;

async function init(client: Client) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS decks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      filename    TEXT NOT NULL,
      num_pages   INTEGER NOT NULL,
      owner_token TEXT NOT NULL,
      ask_page    INTEGER,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_token);

    CREATE TABLE IF NOT EXISTS links (
      id         TEXT PRIMARY KEY,
      deck_id    TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      label      TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_links_deck ON links(deck_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id             TEXT PRIMARY KEY,
      link_id        TEXT NOT NULL,
      deck_id        TEXT NOT NULL,
      ua             TEXT,
      referrer       TEXT,
      max_scroll_pct INTEGER NOT NULL DEFAULT 0,
      max_page       INTEGER NOT NULL DEFAULT 1,
      started_at     INTEGER NOT NULL,
      last_seen_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_deck ON sessions(deck_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_link ON sessions(link_id);

    CREATE TABLE IF NOT EXISTS page_dwell (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      deck_id    TEXT NOT NULL,
      page       INTEGER NOT NULL,
      ms         INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dwell_session ON page_dwell(session_id);
    CREATE INDEX IF NOT EXISTS idx_dwell_deck ON page_dwell(deck_id);
  `);
}

export async function db() {
  if (!_client) {
    _client = createClient({ url: DB_URL });
    _ready = init(_client);
  }
  await _ready;
  return _client;
}

export type Deck = {
  id: string;
  title: string;
  filename: string;
  num_pages: number;
  owner_token: string;
  ask_page: number | null;
  created_at: number;
};

export type Link = {
  id: string;
  deck_id: string;
  slug: string;
  label: string;
  created_at: number;
};

export async function createDeck(input: {
  title: string;
  filename: string;
  numPages: number;
  ownerToken: string;
}): Promise<Deck> {
  const c = await db();
  const id = randId(12);
  const now = Date.now();
  await c.execute({
    sql: `INSERT INTO decks (id, title, filename, num_pages, owner_token, ask_page, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    args: [id, input.title, input.filename, input.numPages, input.ownerToken, now],
  });
  return {
    id,
    title: input.title,
    filename: input.filename,
    num_pages: input.numPages,
    owner_token: input.ownerToken,
    ask_page: null,
    created_at: now,
  };
}

export async function getDeck(id: string): Promise<Deck | null> {
  const c = await db();
  const r = await c.execute({ sql: `SELECT * FROM decks WHERE id = ?`, args: [id] });
  return (r.rows[0] as unknown as Deck) ?? null;
}

export type DeckSummary = Deck & { views: number };

export async function listDecksByOwner(ownerToken: string): Promise<DeckSummary[]> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT d.*, (SELECT COUNT(*) FROM sessions s WHERE s.deck_id = d.id) AS views
          FROM decks d WHERE d.owner_token = ? ORDER BY d.created_at DESC`,
    args: [ownerToken],
  });
  return r.rows as unknown as DeckSummary[];
}

export async function createLink(input: {
  deckId: string;
  slug: string;
  label: string;
}): Promise<Link> {
  const c = await db();
  const id = randId(10);
  const now = Date.now();
  await c.execute({
    sql: `INSERT INTO links (id, deck_id, slug, label, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [id, input.deckId, input.slug, input.label, now],
  });
  return { id, deck_id: input.deckId, slug: input.slug, label: input.label, created_at: now };
}

export async function getLinkBySlug(slug: string): Promise<Link | null> {
  const c = await db();
  const r = await c.execute({ sql: `SELECT * FROM links WHERE slug = ?`, args: [slug] });
  return (r.rows[0] as unknown as Link) ?? null;
}

export type LinkSummary = Link & { sessions: number };

export async function listLinks(deckId: string): Promise<LinkSummary[]> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT l.*, (SELECT COUNT(*) FROM sessions s WHERE s.link_id = l.id) AS sessions
          FROM links l WHERE l.deck_id = ? ORDER BY l.created_at DESC`,
    args: [deckId],
  });
  // libsql rows aren't plain objects, so map before they cross into a client component
  return (r.rows as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    deck_id: String(row.deck_id),
    slug: String(row.slug),
    label: String(row.label),
    created_at: Number(row.created_at),
    sessions: Number(row.sessions),
  }));
}

export async function ingestEvents(input: {
  slug: string;
  sessionId: string;
  ua?: string | null;
  referrer?: string | null;
  pages: { page: number; ms: number }[];
  maxScrollPct?: number;
  maxPage?: number;
}) {
  const link = await getLinkBySlug(input.slug);
  if (!link) return { ok: false };

  const c = await db();
  const now = Date.now();

  await c.execute({
    sql: `INSERT INTO sessions (id, link_id, deck_id, ua, referrer, max_scroll_pct, max_page, started_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            last_seen_at   = excluded.last_seen_at,
            max_scroll_pct = MAX(sessions.max_scroll_pct, excluded.max_scroll_pct),
            max_page       = MAX(sessions.max_page, excluded.max_page)`,
    args: [
      input.sessionId,
      link.id,
      link.deck_id,
      input.ua ?? null,
      input.referrer ?? null,
      Math.round(input.maxScrollPct ?? 0),
      input.maxPage ?? 1,
      now,
      now,
    ],
  });

  const dwell = input.pages.filter((p) => p.ms > 0);
  if (dwell.length) {
    await c.batch(
      dwell.map((p) => ({
        sql: `INSERT INTO page_dwell (session_id, deck_id, page, ms, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [input.sessionId, link.deck_id, p.page, Math.round(p.ms), now] as InArgs,
      })),
      "write"
    );
  }

  return { ok: true };
}

export type SlideStat = { page: number; totalMs: number; views: number; avgMs: number };
export type SessionStat = {
  id: string;
  link_id: string;
  label: string;
  ua: string | null;
  referrer: string | null;
  max_page: number;
  max_scroll_pct: number;
  started_at: number;
  last_seen_at: number;
  totalMs: number;
  reachedAsk: boolean;
  completed: boolean;
};

export type DeckAnalytics = {
  totalSessions: number;
  totalMs: number;
  slides: SlideStat[];
  sessions: SessionStat[];
  reopens: number;
  askPage: number;
};

export async function deckAnalytics(deck: Deck): Promise<DeckAnalytics> {
  const c = await db();
  const askPage = deck.ask_page ?? deck.num_pages;

  const slidesR = await c.execute({
    sql: `SELECT page, SUM(ms) AS totalMs, COUNT(DISTINCT session_id) AS views
          FROM page_dwell WHERE deck_id = ? GROUP BY page`,
    args: [deck.id],
  });
  const byPage = new Map<number, { totalMs: number; views: number }>();
  for (const row of slidesR.rows as unknown as { page: number; totalMs: number; views: number }[]) {
    byPage.set(Number(row.page), { totalMs: Number(row.totalMs), views: Number(row.views) });
  }
  const slides: SlideStat[] = [];
  for (let p = 1; p <= deck.num_pages; p++) {
    const s = byPage.get(p) ?? { totalMs: 0, views: 0 };
    slides.push({
      page: p,
      totalMs: s.totalMs,
      views: s.views,
      avgMs: s.views ? Math.round(s.totalMs / s.views) : 0,
    });
  }

  const sessR = await c.execute({
    sql: `SELECT s.id, s.link_id, l.label, s.ua, s.referrer, s.max_page, s.max_scroll_pct,
                 s.started_at, s.last_seen_at,
                 (SELECT COALESCE(SUM(ms),0) FROM page_dwell d WHERE d.session_id = s.id) AS totalMs
          FROM sessions s JOIN links l ON l.id = s.link_id
          WHERE s.deck_id = ? ORDER BY s.started_at DESC`,
    args: [deck.id],
  });
  const sessions: SessionStat[] = (sessR.rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    link_id: String(r.link_id),
    label: String(r.label),
    ua: (r.ua as string) ?? null,
    referrer: (r.referrer as string) ?? null,
    max_page: Number(r.max_page),
    max_scroll_pct: Number(r.max_scroll_pct),
    started_at: Number(r.started_at),
    last_seen_at: Number(r.last_seen_at),
    totalMs: Number(r.totalMs),
    reachedAsk: Number(r.max_page) >= askPage,
    completed: Number(r.max_page) >= deck.num_pages,
  }));

  const perLink = new Map<string, number>();
  for (const s of sessions) perLink.set(s.link_id, (perLink.get(s.link_id) ?? 0) + 1);
  let reopens = 0;
  for (const n of perLink.values()) reopens += Math.max(0, n - 1);

  const totalMs = sessions.reduce((a, s) => a + s.totalMs, 0);

  return { totalSessions: sessions.length, totalMs, slides, sessions, reopens, askPage };
}
