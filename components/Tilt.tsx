"use client";
import { useRef } from "react";

/** Card that tilts toward the pointer 1:1 and springs back flat when released (Apple: direct manipulation + spring settle). */
export default function Tilt({ className, children }: { className?: string; children: React.ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.current!.style.setProperty("--ry", `${x * 10}deg`);
    el.current!.style.setProperty("--rx", `${-y * 10}deg`);
    el.current!.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    el.current!.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
    el.current!.dataset.track = "1";
  };
  const leave = () => { const s = el.current!.style; s.setProperty("--rx", "0deg"); s.setProperty("--ry", "0deg"); delete el.current!.dataset.track; };
  return <div ref={el} className={`tilt ${className ?? ""}`} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}
