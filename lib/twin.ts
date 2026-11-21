import { TODAY } from "./parser";
import type { AppState, Goal, Txn } from "./types";

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const monthKey = (d: string) => d.slice(0, 7);
export const monthLabel = (k: string) =>
  new Date(k + "-01").toLocaleString("en-IN", { month: "short", year: "numeric" });

const FIXED_CATS = ["Rent", "EMI", "SIP/Investments", "Bills & utilities", "Subscriptions", "Family transfers"];
const FULL_MONTHS = ["2026-08", "2026-09", "2026-10"];

export function debits(txns: Txn[]) {
  return txns.filter((t) => t.dir === "debit");
}

export function byCategory(txns: Txn[], month?: string) {
  const m: Record<string, number> = {};
  for (const t of debits(txns)) {
    if (month && monthKey(t.date) !== month) continue;
    m[t.category] = (m[t.category] ?? 0) + t.amount;
  }
  return m;
}

export function avgByCategory(txns: Txn[]) {
  const sums: Record<string, number> = {};
  for (const mo of FULL_MONTHS) {
    const c = byCategory(txns, mo);
    for (const k in c) sums[k] = (sums[k] ?? 0) + c[k];
  }
  for (const k in sums) sums[k] = sums[k] / FULL_MONTHS.length;
  return sums;
}

export interface Recurring {
  merchant: string;
  category: string;
  amounts: number[];
  last: number;
  prev: number;
  dates: string[];
  cadence: number;
  nextDue: string;
  status: "active" | "price_changed" | "unused";
  note?: string;
  yearly: number;
}

export function detectRecurring(state: AppState): Recurring[] {
  const groups: Record<string, Txn[]> = {};
  for (const t of debits(state.txns)) {
    if (!["Subscriptions", "EMI", "SIP/Investments", "Bills & utilities", "Rent"].includes(t.category) && t.kind !== "autodebit") continue;
    (groups[t.merchant] ??= []).push(t);
  }
  const out: Recurring[] = [];
  for (const [merchant, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    const s = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = s.slice(1).map((t, i) => (+new Date(t.date) - +new Date(s[i].date)) / 864e5);
    const cadence = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    if (cadence < 20 || cadence > 40) continue;
    const last = s[s.length - 1].amount, prev = s[s.length - 2].amount;
    const nd = new Date(s[s.length - 1].date); nd.setDate(nd.getDate() + 30);
    let status: Recurring["status"] = "active";
    let note: string | undefined;
    if (Math.abs(last - prev) / prev > 0.05 && s[0].category === "Subscriptions") {
      status = "price_changed";
      note = `Went from ${inr(prev)} to ${inr(last)} (+${Math.round(((last - prev) / prev) * 100)}%)`;
    }
    if (/cult/i.test(merchant)) {
      const fitness = state.txns.filter((t) => /decathlon|gym|protein|fitness/i.test(t.merchant + t.raw) && t.date >= "2026-09-21");
      if (!fitness.length) { status = "unused"; note = "Zero fitness-related spends in 60 days. Ghost membership? "; }
    }
    out.push({
      merchant, category: s[0].category, amounts: s.map((t) => t.amount), last, prev,
      dates: s.map((t) => t.date), cadence, nextDue: nd.toISOString().slice(0, 10), status, note, yearly: last * 12,
    });
  }
  return out.sort((a, b) => b.last - a.last);
}

export interface Twin {
  income: number;
  fixed: number;
  fixedItems: { name: string; amount: number }[];
  variable: number;
  surplus: number;
  efMonths: number;
  monthlyExpense: number;
  savingsRate: number;
}

export function computeTwin(state: AppState): Twin {
  const avg = avgByCategory(state.txns);
  const fixedItems = FIXED_CATS.filter((c) => avg[c]).map((c) => ({ name: c, amount: avg[c] }));
  const fixed = fixedItems.reduce((a, b) => a + b.amount, 0);
  const variable = Object.entries(avg).filter(([k]) => !FIXED_CATS.includes(k)).reduce((a, [, v]) => a + v, 0);
  const income = state.profile.income;
  const monthlyExpense = fixed + variable;
  const surplus = income - monthlyExpense;
  return {
    income, fixed, fixedItems, variable, surplus,
    efMonths: state.profile.emergencyFund / monthlyExpense,
    monthlyExpense,
    savingsRate: (surplus + (avg["SIP/Investments"] ?? 0)) / income,
  };
}

/** Chai Leak: tiny UPI spends that add up. */
export function chaiLeak(state: AppState) {
  const small = debits(state.txns).filter(
    (t) => t.kind === "upi" && t.amount <= 250 && ["Snacks/Chai", "Other", "Groceries", "Food delivery", "Transport"].includes(t.category) && FULL_MONTHS.includes(monthKey(t.date)),
  );
  const monthly = small.reduce((a, t) => a + t.amount, 0) / FULL_MONTHS.length;
  const perDay = monthly / 30;
  const by: Record<string, { n: number; amt: number }> = {};
  for (const t of small) { const k = t.category === "Other" ? "Mystery UPI" : t.category; (by[k] ??= { n: 0, amt: 0 }); by[k].n++; by[k].amt += t.amount; }
  const count = Math.round(small.length / FULL_MONTHS.length);
  return { monthly, perDay, count, by: Object.entries(by).map(([k, v]) => ({ name: k, n: Math.round(v.n / 3), amt: v.amt / 3 })).sort((a, b) => b.amt - a.amt) };
}

export function monthsBetween(a: string, b: string) {
  return (+new Date(b) - +new Date(a)) / (864e5 * 30.44);
}
export function addMonths(d: string, m: number) {
  const x = new Date(d); x.setDate(x.getDate() + Math.round(m * 30.44));
  return x.toISOString().slice(0, 10);
}

export interface Scenario {
  foodCut: number; // % cut to food delivery + dining
  leakCut: number; // % cut to chai leak
  shoppingCut: number;
  rentHike: number; // % from Mar 2027
  incomeHike: number; // %
  extraSip: number; // ₹/month moved to investing (reduces goal surplus)
  cancelSubs: number; // ₹/month freed
}
export const BASE: Scenario = { foodCut: 0, leakCut: 0, shoppingCut: 0, rentHike: 0, incomeHike: 0, extraSip: 0, cancelSubs: 0 };

export interface Projection {
  goals: { goal: Goal; eta: string; onTrack: boolean; deltaDays: number; monthly: number }[];
  surplus: number;
  series: { month: string; base: number; scenario: number }[];
}

export function simulate(state: AppState, sc: Scenario, withFacts = true): Projection {
  const tw = computeTwin(state);
  const avg = avgByCategory(state.txns);
  const leak = chaiLeak(state).monthly;
  const rent = avg["Rent"] ?? 0;
  const delta =
    ((avg["Food delivery"] ?? 0) + (avg["Dining out"] ?? 0)) * (sc.foodCut / 100) +
    leak * (sc.leakCut / 100) +
    (avg["Shopping"] ?? 0) * (sc.shoppingCut / 100) +
    tw.income * (sc.incomeHike / 100) +
    sc.cancelSubs - sc.extraSip;
  const rentFactKnown = withFacts && state.facts.some((f) => /rent/i.test(f.text));
  const rentHikeEff = sc.rentHike || (rentFactKnown ? 8 : 0);

  const run = (extra: number, hike: number) => {
    // month-by-month cumulative savings for 24 months
    const series: number[] = [];
    let cum = 0;
    for (let i = 0; i < 24; i++) {
      const d = addMonths(TODAY, i);
      const s = tw.surplus + extra - (d >= "2027-03-01" ? rent * (hike / 100) : 0);
      cum += Math.max(s, 0);
      series.push(cum);
    }
    return series;
  };
  const baseSeries = run(0, rentFactKnown ? 8 : 0);
  const scSeries = run(delta, rentHikeEff);

  const goals = state.goals.map((g) => {
    const etaFor = (series: number[]) => {
      const need = g.target - g.saved;
      for (let i = 0; i < series.length; i++) if (series[i] * g.weight >= need) {
        const prev = i ? series[i - 1] * g.weight : 0;
        const frac = (need - prev) / (series[i] * g.weight - prev || 1);
        return addMonths(TODAY, i + frac);
      }
      return addMonths(TODAY, 24 + (need - series[23] * g.weight) / ((series[23] / 24) * g.weight || 1));
    };
    const eta = etaFor(scSeries);
    const baseEta = etaFor(baseSeries);
    return {
      goal: g, eta, onTrack: eta <= g.date,
      deltaDays: Math.round((+new Date(baseEta) - +new Date(eta)) / 864e5),
      monthly: (scSeries[0]) * g.weight,
    };
  });
  return {
    goals, surplus: tw.surplus + delta,
    series: baseSeries.map((b, i) => ({ month: monthLabel(addMonths(TODAY, i).slice(0, 7)), base: Math.round(b), scenario: Math.round(scSeries[i]) })),
  };
}

/** days a goal moves if `monthly` rupees/month are freed */
export function daysGainedOnGoal(state: AppState, goalIdx: number, monthly: number) {
  const g = state.goals[goalIdx];
  const tw = computeTwin(state);
  const alloc = Math.max(tw.surplus * g.weight, 1);
  const need = g.target - g.saved;
  const m1 = need / alloc, m2 = need / (alloc + monthly * g.weight);
  return Math.round((m1 - m2) * 30.44);
}

export function healthScore(state: AppState) {
  const tw = computeTwin(state);
  const ef = Math.min(tw.efMonths / 6, 1) * 30;
  const sr = Math.min(Math.max(tw.savingsRate, 0) / 0.3, 1) * 30;
  const fixedRatio = tw.fixed / tw.income;
  const fx = Math.min(Math.max((0.6 - fixedRatio) / 0.3, 0), 1) * 20;
  const recs = detectRecurring(state);
  const waste = recs.filter((r) => r.status === "unused" && !state.cancelled.includes(r.merchant)).length;
  const sub = Math.max(10 - waste * 5, 0);
  const pace = paceCheck(state);
  const drift = pace.filter((p) => p.ratio > 1.15).length;
  const pc = Math.max(10 - drift * 4, 0);
  const score = Math.round(ef + sr + fx + sub + pc);
  const parts = [
    { label: "Emergency buffer", pts: Math.round(ef), max: 30, note: `${tw.efMonths.toFixed(1)} of 6 months` },
    { label: "Savings rate", pts: Math.round(sr), max: 30, note: `${Math.round(tw.savingsRate * 100)}% (goal 30%)` },
    { label: "Fixed-cost load", pts: Math.round(fx), max: 20, note: `${Math.round(fixedRatio * 100)}% of income` },
    { label: "Subscription hygiene", pts: sub, max: 10, note: waste ? `${waste} ghost sub` : "clean" },
    { label: "On-plan pace", pts: pc, max: 10, note: drift ? `${drift} categories drifting` : "on pace" },
  ];
  const weakest = [...parts].sort((a, b) => a.pts / a.max - b.pts / b.max)[0];
  return { score, parts, weakest };
}

/** Month-to-date pace vs 3-month average */
export function paceCheck(state: AppState) {
  const cur = byCategory(state.txns, "2026-11");
  const avg = avgByCategory(state.txns);
  const day = +TODAY.slice(8, 10);
  const frac = day / 30;
  return ["Food delivery", "Snacks/Chai", "Shopping", "Dining out", "Transport", "Groceries", "Other"]
    .filter((c) => avg[c] > 300)
    .map((c) => ({ category: c, spent: cur[c] ?? 0, expected: avg[c] * frac, avg: avg[c], ratio: (cur[c] ?? 0) / (avg[c] * frac) }))
    .sort((a, b) => b.ratio - a.ratio);
}

export interface Nudge { emoji: string; title: string; body: string; tone: "warn" | "good" | "info"; }

export function nudges(state: AppState): Nudge[] {
  const out: Nudge[] = [];
  const roast = state.voice === "roast";
  const pace = paceCheck(state);
  const goa = state.goals.findIndex((g) => /goa/i.test(g.name));
  for (const p of pace.slice(0, 2)) {
    if (p.ratio > 1.15) {
      const over = p.spent - p.expected;
      const proj = (p.spent / 21) * 30 - p.avg;
      const days = goa >= 0 ? daysGainedOnGoal(state, goa, Math.max(proj, 0)) : 0;
      out.push({
        emoji: "", tone: "warn",
        title: roast ? `${p.category} is in its villain era` : `${p.category} running a little hot`,
        body: roast
          ? `${inr(over)} over pace by day 21. Keep this up and Goa slips ~${days} days. The kitchen misses you bestie.`
          : `You're ${Math.round((p.ratio - 1) * 100)}% ahead of your usual pace. Easing off for 9 days keeps Goa on schedule (~${days} days saved). You got this!`,
      });
    }
  }
  const recs = detectRecurring(state);
  const pc = recs.find((r) => r.status === "price_changed");
  if (pc) out.push({ emoji: "", tone: "warn", title: `${pc.merchant} raised its price`, body: `${pc.note}. That's ${inr((pc.last - pc.prev) * 12)}/year extra for the same shows.` });
  const un = recs.find((r) => r.status === "unused" && !state.cancelled.includes(r.merchant));
  if (un) out.push({ emoji: "", tone: "warn", title: roast ? `${un.merchant} is ghosting your body, not your bank` : `${un.merchant} might be unused`, body: `${inr(un.last)}/month and ${un.note?.toLowerCase()}` });
  const leak = chaiLeak(state);
  out.push({ emoji: "", tone: "info", title: `Chai leak: ${inr(leak.perDay)}/day`, body: `${leak.count} tiny UPI payments a month = ${inr(leak.monthly)}. Halving it gets Goa ${goa >= 0 ? daysGainedOnGoal(state, goa, leak.monthly / 2) : 0} days sooner.` });
  return out;
}

export function vibe(t: Txn): string {
  if (t.dir === "credit") return t.category === "Salary" ? "payday W " : "money in ";
  if (t.category === "Food delivery") return t.amount > 450 ? "delivery fee arc " : "comfort food ";
  if (t.category === "Snacks/Chai") return "chai run ";
  if (t.category === "Shopping") return t.amount > 2000 ? "main character energy " : "lil treat ";
  if (t.category === "SIP/Investments") return "future you says thx ";
  if (t.category === "Subscriptions") return "auto-pilot ";
  if (t.category === "Rent") return "adulting tax ";
  if (t.category === "Other") return "mystery spend ";
  if (t.category === "Groceries") return "certified W ";
  return "NPC purchase ";
}

export function monthStats(state: AppState, month: string) {
  const ms = state.txns.filter((t) => monthKey(t.date) === month);
  const inc = ms.filter((t) => t.dir === "credit").reduce((a, t) => a + t.amount, 0);
  const out = ms.filter((t) => t.dir === "debit").reduce((a, t) => a + t.amount, 0);
  const cats = byCategory(state.txns, month);
  const avg = avgByCategory(state.txns);
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const merchants: Record<string, number> = {};
  for (const t of ms) if (t.dir === "debit") merchants[t.merchant] = (merchants[t.merchant] ?? 0) + 1;
  const topMerchant = Object.entries(merchants).sort((a, b) => b[1] - a[1])[0];
  const biggest = ms.filter((t) => t.dir === "debit" && !["Rent", "SIP/Investments", "Family transfers", "EMI", "Bills & utilities"].includes(t.category)).sort((a, b) => b.amount - a.amount)[0];
  return { month, inc, out, saved: inc - out, cats, avg, top, topMerchant, biggest, count: ms.length };
}
