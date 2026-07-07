"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getPdfjs } from "@/lib/pdf";

type Props = {
  slug: string;
  deckId: string;
  title: string;
  numPages: number;
};

export default function Viewer({ slug, deckId, title, numPages }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);

  // refs so the interval + handlers always read live values
  const sessionId = useRef<string>(crypto.randomUUID());
  const activeRef = useRef(1);
  const dwell = useRef<Map<number, number>>(new Map()); // unsent ms per page
  const lastTick = useRef<number>(Date.now());
  const maxPage = useRef(1);
  const maxScroll = useRef(0);
  const pageEls = useRef<Map<number, HTMLElement>>(new Map());

  const registerEl = useCallback((page: number, el: HTMLElement | null) => {
    if (el) pageEls.current.set(page, el);
    else pageEls.current.delete(page);
  }, []);

  const flush = useCallback(
    (useBeacon = false) => {
      const pages = Array.from(dwell.current.entries())
        .filter(([, ms]) => ms > 0)
        .map(([page, ms]) => ({ page, ms }));
      dwell.current.clear();

      const payload = {
        slug,
        sessionId: sessionId.current,
        pages,
        maxScrollPct: Math.round(maxScroll.current),
        maxPage: maxPage.current,
        referrer: typeof document !== "undefined" ? document.referrer : "",
      };
      const body = JSON.stringify(payload);

      if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [slug]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/file/${deckId}`);
        if (!res.ok) throw new Error("Could not load deck");
        const data = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await getPdfjs();
        const loaded = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  // count time on the active slide, foreground only
  useEffect(() => {
    lastTick.current = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      // cap dt so a backgrounded/throttled gap doesn't dump seconds onto a slide
      const focused =
        document.visibilityState === "visible" &&
        (typeof document.hasFocus === "function" ? document.hasFocus() : true);
      if (focused && dt > 0 && dt < 4000) {
        const p = activeRef.current;
        dwell.current.set(p, (dwell.current.get(p) ?? 0) + dt);
      }
    }, 1000);

    const flushTimer = setInterval(() => flush(false), 5000);

    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    flush(false); // create the session up front so an instant bounce still counts

    return () => {
      clearInterval(tick);
      clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [flush]);

  // which slide is at the viewport center + how far they scrolled
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const centerY = window.innerHeight / 2;
      let best = activeRef.current;
      let bestDist = Infinity;
      for (const [page, el] of pageEls.current) {
        const r = el.getBoundingClientRect();
        if (r.top <= centerY && r.bottom >= centerY) {
          best = page;
          bestDist = 0;
          break;
        }
        const dist = Math.min(Math.abs(r.top - centerY), Math.abs(r.bottom - centerY));
        if (dist < bestDist) {
          bestDist = dist;
          best = page;
        }
      }
      if (best !== activeRef.current) {
        activeRef.current = best;
        setActivePage(best);
      }
      if (best > maxPage.current) maxPage.current = best;

      const docH = document.documentElement.scrollHeight;
      const pct = docH > 0 ? ((window.scrollY + window.innerHeight) / docH) * 100 : 0;
      if (pct > maxScroll.current) maxScroll.current = Math.min(100, pct);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const t = setTimeout(measure, 300); // once pages have laid out
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc]);

  if (error) {
    return (
      <div className="msg">
        <div className="card msg-card">
          <div className="msg-icon">&#128533;</div>
          <div className="msg-title">This deck link isn&apos;t available.</div>
          <p className="hint" style={{ marginTop: 6 }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <div className="brand">
          <span className="dot" />
          {title}
        </div>
        <span className="faint mono viewer-count">
          {activePage} / {numPages}
        </span>
      </div>

      <div className="viewer-stage">
        {!doc && (
          <div className="msg">
            <div className="spinner" />
            <p className="hint" style={{ marginTop: 12 }}>
              Loading deck...
            </p>
          </div>
        )}
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => i + 1).map((p) => (
            <SlidePage key={p} doc={doc} pageNumber={p} registerEl={registerEl} />
          ))}
      </div>

      <div className="viewer-foot faint">powered by DeckPeek</div>
    </div>
  );
}

function SlidePage({
  doc,
  pageNumber,
  registerEl,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  registerEl: (page: number, el: HTMLElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<number>(0.5625);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setAspect(base.height / base.width);
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const cssWidth = Math.min(wrap.clientWidth, 920);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (cssWidth * dpr) / base.width;
      const vp = page.getViewport({ scale });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const el = wrapRef.current;
    registerEl(pageNumber, el);
    return () => registerEl(pageNumber, null);
  }, [pageNumber, registerEl]);

  return (
    <div ref={wrapRef} className="slide" data-page={pageNumber}>
      <canvas ref={canvasRef} style={{ aspectRatio: `1 / ${aspect}`, width: "100%" }} />
    </div>
  );
}
