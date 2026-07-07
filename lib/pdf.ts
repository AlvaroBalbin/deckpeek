type Pdfjs = typeof import("pdfjs-dist");

let mod: Pdfjs | null = null;

// load pdf.js lazily so it only ever runs in the browser
export async function getPdfjs() {
  if (!mod) {
    mod = await import("pdfjs-dist");
    mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return mod;
}
