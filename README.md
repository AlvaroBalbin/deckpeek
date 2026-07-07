# DeckPeek

See how people actually read your pitch deck. Upload a PDF, share a link, and
get the numbers that matter: time on each slide, how far they scrolled, whether
they reached your ask, and if they came back.

Self-hosted, no accounts, no data leaves your machine. MIT.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, drop in a PDF, make a link, and open it in another
tab. Scroll through, then reload the deck page to see the numbers.

## How it works

You can't track a raw PDF, so DeckPeek renders it in its own viewer behind a
link. You send the link, not the file. The viewer records time per slide, scroll
depth and the furthest slide reached, and writes it to a local SQLite file. The
deck page reads that back as an attention heatmap plus a per-session list.

Next.js + libsql (SQLite) + pdf.js. Uploads land in `data/uploads`, the db is
`data/deckpeek.db`.

## Config

- `DECKPEEK_DB_URL`: libsql url, defaults to `file:data/deckpeek.db` (point it at
  Turso to go remote)
- `DECKPEEK_UPLOAD_DIR`: where PDFs are stored, defaults to `data/uploads`

## Heads up

It's an MVP. There's no real auth yet (an owner is just a cookie), so add that,
plus rate limiting and shared storage, before you rely on it. PRs welcome.
