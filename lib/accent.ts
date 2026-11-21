// Accent colour follows "money left this month": bright green at ₹1L+ down to maroon under ₹5k.
// Mood colour, relative to the person's own average month (ratio = money left now / usual money left).
// Lime is home. Only 4 colours: red when it's going badly, amber when it's slipping, lime when normal, green when it's going well.
const STOPS: [number, string][] = [
  [0.4, "#ff4d4d"],   // red
  [0.7, "#ffb020"],   // amber
  [0.75, "#d4ff3a"],  // lime (normal band 0.75 to 1.25)
  [1.25, "#d4ff3a"],
  [1.5, "#3dff8a"],   // green
];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export function accentFor(ratio: number) {
  const x = Math.max(STOPS[0][0], Math.min(STOPS[STOPS.length - 1][0], isFinite(ratio) ? ratio : 1));
  let i = 0; while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++;
  const [a0, c0] = STOPS[i], [a1, c1] = STOPS[i + 1];
  const c = mix(hex(c0), hex(c1), a1 === a0 ? 0 : (x - a0) / (a1 - a0));
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  return {
    accent: toHex(c),
    ink: lum > 0.5 ? "#0b0b0b" : "#ffffff",
    shadow: toHex(c.map((v) => v * 0.5)),
    wash: toHex(mix([8, 8, 10], c, 0.14)),
  };
}

let base = 1; let override: number | null = null;
function apply() {
  if (typeof document === "undefined") return;
  const a = accentFor(override ?? base), s = document.documentElement.style;
  s.setProperty("--lime", a.accent); s.setProperty("--purple", a.accent);
  s.setProperty("--accent-ink", a.ink); s.setProperty("--key-shadow", a.shadow);
  s.setProperty("--lime-wash", a.wash); s.setProperty("--tint", a.wash);
}
export function setAccentBase(n: number) { base = n; apply(); }
export function setAccentOverride(n: number | null) { override = n; apply(); }
