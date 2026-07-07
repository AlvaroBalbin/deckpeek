import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createLink, getDeck, type Link } from "@/lib/db";
import { shareSlug } from "@/lib/ids";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { deckId?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const deckId = body.deckId ? String(body.deckId) : "";
  const label = (body.label ? String(body.label) : "").trim().slice(0, 60) || "Untitled link";
  if (!deckId) return NextResponse.json({ error: "deckId required" }, { status: 400 });

  const deck = await getDeck(deckId);
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  const jar = await cookies();
  if (jar.get("dp_owner")?.value !== deck.owner_token) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Retry on the rare slug collision (unique constraint).
  let link: Link | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      link = await createLink({ deckId: deck.id, slug: shareSlug(label), label });
      break;
    } catch (e) {
      if (i === 4) throw e;
    }
  }

  return NextResponse.json({ slug: link!.slug, id: link!.id, label: link!.label });
}
