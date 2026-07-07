import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ingestEvents } from "@/lib/db";

export const runtime = "nodejs";

type Incoming = {
  slug?: string;
  sessionId?: string;
  pages?: { page: number; ms: number }[];
  maxScrollPct?: number;
  maxPage?: number;
  referrer?: string;
};

export async function POST(req: Request) {
  let body: Incoming;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { slug, sessionId, pages } = body;
  if (!slug || !sessionId || !Array.isArray(pages)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const h = await headers();
  const cleanPages = pages
    .filter((p) => p && typeof p.page === "number" && typeof p.ms === "number")
    .map((p) => ({ page: p.page, ms: p.ms }));

  const res = await ingestEvents({
    slug: String(slug),
    sessionId: String(sessionId),
    ua: h.get("user-agent"),
    referrer: body.referrer ? String(body.referrer).slice(0, 300) : null,
    pages: cleanPages,
    maxScrollPct: Number(body.maxScrollPct) || 0,
    maxPage: Number(body.maxPage) || 1,
  });

  return NextResponse.json(res);
}
