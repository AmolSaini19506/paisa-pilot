// Accent colour follows "money left this month": bright green at ₹1L+ down to maroon under ₹5k.
const STOPS: [number, string][] = [
  [0, "#7a1424"],      // maroon
  [5000, "#d63a3a"],   // red
  [15000, "#ff7a2f"],  // orange
  [30000, "#e2ad2b"],  // mustard
  [50000, "#ffe14a"],  // yellow
  [75000, "#9ed35a"],  // dull green
  [100000, "#3dff72"], // bright green
];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export function accentFor(amount: number) {
  const x = Math.max(0, Math.min(100000, amount));
  let i = 0; while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++;
  const [a0, c0] = STOPS[i], [a1, c1] = STOPS[i + 1];
  const c = mix(hex(c0), hex(c1), (x - a0) / (a1 - a0));
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  return {
    accent: toHex(c),
    ink: lum > 0.5 ? "#0b0b0b" : "#ffffff",
    shadow: toHex(c.map((v) => v * 0.5)),
    wash: toHex(mix([8, 8, 10], c, 0.14)),
  };
}

let base = 40000; let override: number | null = null;
function apply() {
  if (typeof document === "undefined") return;
  const a = accentFor(override ?? base), s = document.documentElement.style;
  s.setProperty("--lime", a.accent); s.setProperty("--purple", a.accent);
  s.setProperty("--accent-ink", a.ink); s.setProperty("--key-shadow", a.shadow);
  s.setProperty("--lime-wash", a.wash); s.setProperty("--tint", a.wash);
}
export function setAccentBase(n: number) { base = n; apply(); }
export function setAccentOverride(n: number | null) { override = n; apply(); }
