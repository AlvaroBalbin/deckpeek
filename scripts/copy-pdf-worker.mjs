// Copies the pdf.js worker into /public so the viewer can load it locally
// (no CDN, fully self-hostable). Runs on postinstall.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = join(root, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[deckpeek] pdf.worker.min.mjs not found yet, skipping copy:", src);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
cpSync(src, dest);
console.log("[deckpeek] copied pdf worker -> public/pdf.worker.min.mjs");
