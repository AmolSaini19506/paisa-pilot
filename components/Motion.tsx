"use client";
import { useEffect, useRef, useState } from "react";

/** Critically damped spring (damping 1.0). Interruptible: a new target starts from the current on-screen value and velocity. */
export function useSpring(target: number, response = 0.5) {
  const [v, setV] = useState(0);
  const st = useRef({ x: 0, vel: 0, raf: 0, last: 0 });
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { st.current.x = target; setV(target); return; }
    const w = (2 * Math.PI) / response;
    const s = st.current;
    cancelAnimationFrame(s.raf);
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - s.last) / 1000); s.last = now;
      const a = w * w * (target - s.x) - 2 * w * s.vel; // critically damped
      s.vel += a * dt; s.x += s.vel * dt;
      if (Math.abs(target - s.x) < 0.5 && Math.abs(s.vel) < 1) { s.x = target; s.vel = 0; setV(target); return; }
      setV(s.x); s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [target, response]);
  return v;
}

/** A number that springs to its value (counts up on first show, glides on change). */
export function Num({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useSpring(value);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{format(Math.round(v))}</span>;
}
