import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "node:fs/promises";
import { createDeck } from "@/lib/db";
import { UPLOAD_DIR, pdfPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim() || "Untitled deck";
  const numPages = parseInt(String(form.get("numPages") ?? "0"), 10);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF files only" }, { status: 400 });
  }
  if (!Number.isFinite(numPages) || numPages < 1) {
    return NextResponse.json({ error: "Invalid page count" }, { status: 400 });
  }

  const jar = await cookies();
  const ownerToken = jar.get("dp_owner")?.value;
  if (!ownerToken) {
    return NextResponse.json({ error: "No owner session" }, { status: 400 });
  }

  const deck = await createDeck({
    title,
    filename: file.name || "deck.pdf",
    numPages,
    ownerToken,
  });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(pdfPath(deck.id), buf);

  return NextResponse.json({ id: deck.id });
}
