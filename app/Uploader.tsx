"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPdfjs } from "@/lib/pdf";

type State = "idle" | "reading" | "ready" | "uploading" | "error";

export default function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    if (f.type && f.type !== "application/pdf") {
      setError("That's not a PDF.");
      setState("error");
      return;
    }
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, ""));
    setState("reading");
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      setNumPages(doc.numPages);

      // render the first page as a small preview
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 320 / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      setThumb(canvas.toDataURL("image/png"));
      setState("ready");
    } catch (e) {
      console.error(e);
      setError("Could not read that PDF.");
      setState("error");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const submit = useCallback(async () => {
    if (!file || !numPages) return;
    setState("uploading");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim() || "Untitled deck");
      fd.append("numPages", String(numPages));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      const { id } = await res.json();
      router.push(`/deck/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    }
  }, [file, numPages, title, router]);

  const reset = () => {
    setState("idle");
    setFile(null);
    setThumb(null);
    setNumPages(0);
    setError(null);
  };

  if (state === "ready" || state === "uploading") {
    return (
      <div className="card upload">
        {thumb && <img src={thumb} alt="First slide" className="upload-thumb" />}
        <div className="upload-body">
          <label className="section-title" htmlFor="title">
            Deck title
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Seed round deck"
          />
          <p className="hint" style={{ marginTop: 10 }}>
            {numPages} slide{numPages === 1 ? "" : "s"} &middot; {file?.name}
          </p>
          {error && <div className="chip chip-hot">{error}</div>}
          <div className="upload-actions">
            <button className="btn btn-primary" onClick={submit} disabled={state === "uploading"}>
              {state === "uploading" ? "Uploading..." : "Create tracked deck"}
            </button>
            <button className="btn btn-ghost" onClick={reset} disabled={state === "uploading"}>
              Choose another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card dropzone${dragging ? " drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="dropzone-icon">&#128196;</div>
      <div className="dropzone-title">
        {state === "reading" ? "Reading your deck..." : "Drop a PDF, or click to choose"}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Your deck becomes a private, tracked link. Nothing is shared until you send it.
      </p>
      {error && <div className="chip chip-hot">{error}</div>}
    </div>
  );
}
