"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Apple-style sheet. Desktop: panel from the right edge. Mobile: bottom sheet.
 * Tracks the pointer 1:1 from where it was grabbed, rubber-bands past the open position,
 * projects release momentum to decide dismiss vs. snap back, and leaves along the path it came in on.
 */
const project = (v: number, d = 0.99) => ((v / 1000) * d) / (1 - d);
const rubber = (o: number, dim: number, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

export default function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; last: number; t: number; vel: number; axis: "x" | "y"; size: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { if (open) { setMounted(true); setClosing(false); setOffset(0); } else if (mounted) dismiss(); }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!mounted) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [mounted, onClose]);

  // keyboard: move focus in, keep Tab inside, give it back to the opener on close
  useEffect(() => {
    if (!mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusables = () => el ? [...el.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter((x) => x.tabIndex >= 0 && !x.hasAttribute("disabled") && x.getClientRects().length > 0) : [];
    (focusables()[0] ?? el)?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) { e.preventDefault(); el?.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { window.removeEventListener("keydown", trap); opener?.focus?.(); };
  }, [mounted]);

  function dismiss() { setClosing(true); setTimeout(() => { setMounted(false); setClosing(false); setOffset(0); }, 320); }

  const mobile = () => window.matchMedia("(max-width: 860px)").matches;
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    const axis = mobile() ? "y" : "x";
    const r = panel.current!.getBoundingClientRect();
    const p = axis === "y" ? e.clientY : e.clientX;
    drag.current = { start: p - offset, last: p, t: performance.now(), vel: 0, axis, size: axis === "y" ? r.height : r.width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = d.axis === "y" ? e.clientY : e.clientX;
    const now = performance.now(), dt = Math.max(1, now - d.t);
    d.vel = 0.8 * ((p - d.last) / dt) * 1000 + 0.2 * d.vel; d.last = p; d.t = now;
    const raw = p - d.start;
    setOffset(raw < 0 ? rubber(raw, d.size) : raw);
  };
  const up = () => {
    const d = drag.current; if (!d) return; drag.current = null; setDragging(false);
    const projected = offset + project(d.vel);
    if (projected > d.size * 0.45 || d.vel > 900) onClose(); else setOffset(0);
  };

  if (!mounted) return null;
  const state = closing ? "out" : "in";
  return (
    <>
      <div className={`sheet-scrim ${state}`} onClick={onClose} style={{ opacity: closing ? 0 : undefined }} />
      <div
        ref={panel}
        role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`sheet ${state} ${dragging ? "dragging" : ""}`}
        style={{ ["--off" as any]: `${offset}px` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      >
        <div className="sheet-grabber" aria-hidden />
        {children}
      </div>
    </>
  );
}
