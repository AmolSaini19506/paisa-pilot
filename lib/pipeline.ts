import { buildMemory, categorize } from "./categorize";
import { dedupeKey, isValidTxnDate, parseSms, parseStatementLine, prettyMerchant, rawTags, TODAY, type ParsedSms } from "./parser";
import { ai } from "./store";
import type { AppState, TraceStep, Txn } from "./types";
import { detectRecurring, inr, monthLeft } from "./twin";

export interface IngestResult {
  added: Txn[];
  skipped: { raw: string; why: string }[];
  steps: TraceStep[];
  diff: string[];
  llmUsed: boolean;
}

export async function ingest(state: AppState, source: "sms" | "csv" | "pdf", pre: ParsedSms[] | null, rawLines: string[]): Promise<IngestResult> {
  const t0 = performance.now();
  const steps: TraceStep[] = [];
  const st = (agent: string, action: string, detail?: string) => steps.push({ agent, action, detail, ms: Math.round(performance.now() - t0) });
  const skipped: IngestResult["skipped"] = [];
  let llmUsed = false;

  // 1. classify + extract (regex fast path)
  const parsed: ParsedSms[] = pre ?? rawLines.map(parseSms);
  const kinds: Record<string, number> = {};
  parsed.forEach((p) => (kinds[p.smsKind] = (kinds[p.smsKind] ?? 0) + 1));
  st("Ingest", `Classified ${parsed.length} ${source.toUpperCase()} item(s) into kinds`, Object.entries(kinds).map(([k, v]) => `${k}:${v}`).join("  "));
  const good = parsed.filter((p) => p.ok);
  parsed.filter((p) => p.smsKind === "otp" || p.smsKind === "promo").forEach((p) => skipped.push({ raw: p.raw, why: p.smsKind === "otp" ? "OTP, not a transaction " : "Promo spam " }));
  const unknown = parsed.filter((p) => !p.ok && p.smsKind === "unknown");
  st("Ingest", `Regex templates matched ${good.length}/${parsed.length}`, unknown.length ? `${unknown.length} unmatched → LLM fallback` : "no LLM needed");

  // 2. LLM fallback for unmatched
  if (unknown.length) {
    const r = await ai<any[]>("parse", { lines: unknown.map((u) => u.raw) });
    steps.push(...r.trace);
    llmUsed ||= r.llm;
    const got = new Set<number>();
    for (const x of r.data ?? []) {
      if (!x || !x.amount) continue;
      got.add(x.idx);
      good.push({
        ok: true, smsKind: x.dir === "credit" ? "credit" : "debit", amount: +x.amount, dir: x.dir, kind: x.kind ?? "other",
        date: x.date, vpa: x.vpa ?? undefined, ref: x.ref ?? undefined, merchant: prettyMerchant(x.merchant ?? "", x.vpa ?? undefined), raw: unknown[x.idx]?.raw ?? "",
      });
    }
    let det = 0;
    unknown.forEach((u, i) => {
      if (got.has(i)) return;
      const sl = parseStatementLine(u.raw);
      if (sl) { good.push(sl); det++; } else skipped.push({ raw: u.raw, why: "Couldn't read this one " });
    });
    if (det) st("Ingest", `Statement-row parser recovered ${det} line(s)`);
  }

  // 2b. sanity: drop impossible dates, future dates and zero amounts
  for (let i = good.length - 1; i >= 0; i--) {
    const p = good[i];
    const why = !(p.amount! > 0) ? "Amount is ₹0, nothing to track " : !isValidTxnDate(p.date) ? (p.date && p.date > TODAY ? "Date is in the future " : "Date doesn't exist ") : "";
    if (why) { skipped.push({ raw: p.raw, why }); good.splice(i, 1); }
  }

  // 3. dedupe (wallet + bank double alerts, re-imports)
  const seen = new Set(state.txns.map((t) => dedupeKey(t)));
  const fresh: ParsedSms[] = [];
  let dupes = 0;
  for (const p of good) {
    const k = dedupeKey({ amount: p.amount!, date: p.date!, ref: p.ref, dir: p.dir! });
    if (seen.has(k)) { dupes++; skipped.push({ raw: p.raw, why: "Duplicate alert, merged " }); continue; }
    seen.add(k); fresh.push(p);
  }
  st("Ingest", `De-duplicated on ref/amount/date`, `${dupes} duplicate(s) merged`);

  // 4. categorize: rules -> memory -> seed -> LLM
  const memory = buildMemory(state.txns);
  const txns: Txn[] = fresh.map((p, i) => {
    const c = categorize({ vpa: p.vpa, merchant: p.merchant!, raw: p.raw, dir: p.dir! }, state.rules, memory);
    return {
      id: `i${Date.now()}${i}`, date: p.date!, amount: p.amount!, dir: p.dir!, kind: p.kind ?? "other", raw: p.raw,
      merchant: p.merchant!, vpa: p.vpa, ref: p.ref, bank: p.bank, category: c.category, src: c.src, conf: c.conf,
    };
  });
  const tiers = { rule: 0, memory: 0, seed: 0 } as Record<string, number>;
  txns.forEach((t) => { if (t.category !== "Other") tiers[t.src] = (tiers[t.src] ?? 0) + 1; });
  st("Categorizer", "Tiered lookup: learned rules → merchant memory → seed map", `rule:${tiers.rule ?? 0} memory:${tiers.memory ?? 0} seed:${tiers.seed ?? 0}`);
  const unk = txns.map((t, i) => ({ t, i })).filter(({ t }) => t.category === "Other" || (t.dir === "credit" && t.conf < 0.5));
  if (unk.length) {
    const r = await ai<any[]>("categorize", { items: unk.map(({ t, i }) => ({ i, merchant: t.merchant, vpa: t.vpa, raw: t.raw.slice(0, 160), amount: t.amount })) });
    steps.push(...r.trace);
    llmUsed ||= r.llm;
    for (const x of r.data ?? []) {
      const t = txns[x.i];
      if (!t) continue;
      t.category = x.category; t.conf = x.conf ?? 0.6; t.src = "llm";
      if (t.conf < 0.7) t.review = true;
    }
  }

  // 5. Twin diff
  const after: AppState = { ...state, txns: [...txns, ...state.txns] };
  const before = monthLeft(state).projected, now = monthLeft(after).projected;
  const reasons: Record<string, number> = {};
  for (const k of skipped) { const w = k.why.trim(); reasons[w] = (reasons[w] ?? 0) + 1; }
  const whyTxt = Object.entries(reasons).map(([w, n]) => `${n} ${w.startsWith("OTP") ? "OTP" : w.replace(/,.*$/, "").toLowerCase()}`).join(", ");
  const diff: string[] = [`+${txns.length} transactions from ${source.toUpperCase()}${skipped.length ? ` (${skipped.length} skipped: ${whyTxt})` : ""}`];
  const recB = new Set(detectRecurring(state).filter((r) => r.status !== "active").map((r) => r.merchant + r.status));
  for (const r of detectRecurring(after)) if (r.status !== "active" && !recB.has(r.merchant + r.status)) diff.push(`Subscription alert: ${r.merchant} — ${r.note}`);
  const llmRows = txns.filter((t) => t.src === "llm");
  if (llmRows.length) diff.push(`AI categorised ${llmRows.length} new merchant(s): ${llmRows.slice(0, 3).map((t) => `${t.merchant} → ${t.category}`).join(", ")}${llmRows.length > 3 ? ` and ${llmRows.length - 3} more` : ""}`);
  const review = txns.filter((t) => t.review).length;
  if (review) diff.push(`${review} low-confidence row(s) sent to "To review" — fix one and I'll learn a rule`);
  if (Math.abs(now - before) > 1) diff.push(`Money left this month ${inr(before)} → ${inr(now)}`);
  st("Twin builder", "Updated Money Twin + wrote memory diff", diff.join(" | "));

  // privacy: never keep the full SMS (balances, account numbers)
  txns.forEach((t) => { t.raw = rawTags(t.raw); });
  return { added: txns, skipped, steps, diff, llmUsed };
}
