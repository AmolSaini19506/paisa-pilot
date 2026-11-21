import { SEED_MAP } from "./categories";
import type { CatSource, Rule, Txn } from "./types";

export function ruleMatches(r: Rule, t: Pick<Txn, "vpa" | "merchant" | "raw">): boolean {
  const v = (r.field === "vpa" ? t.vpa ?? "" : `${t.merchant} ${t.raw}`).toLowerCase();
  const p = r.pattern.toLowerCase();
  if (!v) return false;
  if (r.type === "prefix") return r.field === "vpa" ? v.startsWith(p) : v.split(/\s+/).some((w) => w.startsWith(p));
  if (r.type === "equals") return v === p;
  return v.includes(p);
}

/** True when every transaction rule `a` matches is guaranteed to match rule `b` (a is the same or narrower). */
export function implies(a: Pick<Rule, "field" | "type" | "pattern">, b: Pick<Rule, "field" | "type" | "pattern">): boolean {
  if (a.field !== b.field) return false;
  const A = a.pattern.toLowerCase().trim(), B = b.pattern.toLowerCase().trim();
  if (!A || !B) return false;
  if (b.type === "equals") return a.type === "equals" && A === B;
  if (b.type === "prefix") {
    if (a.type === "prefix") return A.startsWith(B);
    if (a.type === "equals") return b.field === "vpa" ? A.startsWith(B) : A.split(/\s+/).some((w) => w.startsWith(B));
    return false;
  }
  return A.includes(B); // b is "contains": any a whose matched text always contains A also contains B
}

export function categorize(
  t: Pick<Txn, "vpa" | "merchant" | "raw" | "dir">,
  rules: Rule[],
  memory: Map<string, string>,
): { category: string; src: CatSource; conf: number; ruleId?: string } {
  for (const r of rules) if (ruleMatches(r, t)) return { category: r.category, src: "rule", conf: 0.99, ruleId: r.id };
  const mk = (t.vpa || t.merchant).toLowerCase();
  const mem = memory.get(mk);
  if (mem) return { category: mem, src: "memory", conf: 0.95 };
  const text = `${t.merchant} ${t.vpa ?? ""} ${t.raw}`;
  // "REFUND AMAZON" is money back, not a Shopping credit: check refunds before merchant names
  if (t.dir === "credit" && /refund|reversed|reversal/i.test(text)) return { category: "Refund", src: "seed", conf: 0.9 };
  for (const [re, c] of SEED_MAP) if (re.test(text)) return { category: c, src: "seed", conf: 0.9 };
  if (t.dir === "credit") return { category: "Refund", src: "seed", conf: 0.4 };
  return { category: "Other", src: "seed", conf: 0.2 };
}

/** Merchant memory = user-confirmed merchant -> category pairs. */
export function buildMemory(txns: Txn[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of txns) if (t.src === "user") m.set((t.vpa || t.merchant).toLowerCase(), t.category);
  return m;
}

/** Payment aggregators: one UPI prefix covers thousands of unrelated shops. */
export const AGGREGATOR = /^(bharatpe|paytmqr|paytm|phonepe|gpay|razorpay|cashfree|payu|upi|q\d)/i;

/** Deterministic rule proposal (the LLM version refines/explains this). */
export function proposeRule(t: Txn, category: string, all: Txn[]): Omit<Rule, "id" | "createdAt" | "hits"> & { matches: number } {
  let cand: Omit<Rule, "id" | "createdAt" | "hits">;
  if (t.vpa) {
    const handle = t.vpa.split("@")[0];
    const prefix = handle.replace(/[\d._-]+$/, "").replace(/\d+/g, "");
    const usePrefix = prefix.length >= 4 && prefix !== handle && !AGGREGATOR.test(handle);
    cand = usePrefix
      ? { field: "vpa", type: "prefix", pattern: prefix, category, why: `All UPI IDs starting with "${prefix}" look like the same kind of merchant` }
      : { field: "vpa", type: "equals", pattern: t.vpa, category, why: `This exact UPI ID` };
  } else {
    const word = t.merchant.split(/\s+/)[0];
    cand = { field: "merchant", type: "contains", pattern: word.toLowerCase(), category, why: `Merchant name contains "${word}"` };
  }
  const matches = all.filter((x) => x.dir === "debit" && ruleMatches({ ...cand, id: "", createdAt: "", hits: 0 }, x)).length;
  return { ...cand, matches };
}

export function accuracy(txns: Txn[]): number {
  const d = txns.filter((t) => t.dir === "debit");
  if (!d.length) return 0;
  // only count what the app labelled on its own; manual fixes aren't "auto"
  return Math.round((d.filter((t) => t.src !== "user" && t.category !== "Other" && !t.review).length / d.length) * 100);
}
