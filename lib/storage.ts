import { join } from "node:path";

export const UPLOAD_DIR = process.env.DECKPEEK_UPLOAD_DIR ?? "data/uploads";

export function pdfPath(id: string) {
  return join(UPLOAD_DIR, `${id}.pdf`);
}

// ids are base36, so anything else is a traversal attempt
export function isSafeId(id: string) {
  return /^[a-z0-9]{1,40}$/.test(id);
}
