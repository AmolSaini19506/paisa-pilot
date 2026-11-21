import { BRAND } from "./categories";
import type { Dir, Kind, Txn } from "./types";

export type SmsKind =
  | "debit" | "credit" | "upi_debit" | "upi_credit" | "card" | "autodebit" | "refund" | "otp" | "promo" | "unknown";

export interface ParsedSms {
  ok: boolean;
  smsKind: SmsKind;
  amount?: number;
  dir?: Dir;
  kind?: Kind;
  date?: string;
  merchant?: string;
  vpa?: string;
  ref?: string;
  bank?: string;
  raw: string;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export const TODAY = "2026-11-21";

/** "1,00,000.50" / "Rs.500" / "INR 2,499" / "₹ 99" -> number */
export function parseAmount(input: string): number | undefined {
  // never read the balance as the amount: drop "Avl Bal INR 1.2 lakh" style clauses first
  const s = input.replace(/(?:avl\.?\s*bal(?:ance)?|available\s+bal(?:ance)?|a\/c\s+bal(?:ance)?|closing\s+bal(?:ance)?|\bbal(?:ance)?)\s*(?:is|:|-)?\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|cr|k|l\b)?/gi, " ");
  // prefer the figure right next to debited/credited/paid/sent/received
  const near = s.match(/(?:debited|credited|paid|sent|received|spent|withdrawn)\b[^₹\d]{0,25}((?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?(?:\s*(?:lakhs?|lacs?|crores?|cr|k|l)\b)?)/i);
  if (near && near[1] !== s) { const v = parseAmount(near[1]); if (v !== undefined) return v; }
  const big = s.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|l|crores?|cr|k)\b/i);
  if (big) {
    const u = big[2].toLowerCase();
    const mult = u.startsWith("c") ? 1e7 : u === "k" ? 1e3 : 1e5;
    const n = parseFloat(big[1].replace(/,/g, "")) * mult;
    return isNaN(n) ? undefined : Math.round(n * 100) / 100;
  }
  const m = s.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

export function parseDate(s: string, fallback = TODAY): string {
  for (const mm of s.matchAll(/\b(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ]?(\d{2,4})?/g)) {
    if (!MONTHS[mm[2].toLowerCase()]) continue;
    const y = mm[3] ? (mm[3].length === 2 ? "20" + mm[3] : mm[3]) : fallback.slice(0, 4);
    return `${y}-${MONTHS[mm[2].toLowerCase()]}-${mm[1].padStart(2, "0")}`;
  }
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/yesterday/i.test(s)) {
    const d = new Date(fallback); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return fallback;
}

/** A real calendar date (no 30-Feb) that isn't in the future. */
export function isValidTxnDate(d: string | undefined, today = TODAY): boolean {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== dd) return false;
  return d <= today && y >= 2000;
}

/** Keep only what categorising needs: mask account numbers, refs and balances. */
/** Raw SMS/narration text is not kept. Keep only the few keywords later checks rely on (gym use, refunds). */
export function rawTags(raw?: string): string {
  return [...new Set((raw ?? "").toLowerCase().match(/decathlon|gym|protein|fitness|refund|reversal/g) ?? [])].join(" ");
}

export function redactRaw(raw: string): string {
  return raw
    .replace(/(avl\.?\s*bal|available balance|bal)[^.;]*/gi, "")
    .replace(/\b(?:a\/c|ac|acct|card)\s*(?:no\.?)?\s*[x*]*\d+/gi, "a/c ••")
    .replace(/\b\d{6,}\b/g, "••")
    .replace(/\.\s*\./g, ".")
    .slice(0, 160)
    .trim();
}

export function detectBank(s: string): string | undefined {
  const banks = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "IDFC", "Yes Bank", "PNB", "BOB", "IndusInd"];
  return banks.find((b) => new RegExp(`\\b${b}\\b`, "i").test(s));
}

export function prettyMerchant(raw: string, vpa?: string): string {
  const src = `${raw} ${vpa ?? ""}`;
  for (const [re, name] of BRAND) if (re.test(src)) return name;
  if (vpa) {
    const handle = vpa.split("@")[0];
    if (/^bharatpe/i.test(handle)) return "BharatPe " + handle.replace(/\D/g, "").slice(-4);
    if (/^paytmqr/i.test(handle)) return "Paytm QR " + handle.replace(/\D/g, "").slice(-4);
    return handle.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }
  return raw.replace(/\s+/g, " ").trim().slice(0, 40) || "Unknown";
}

/** Tier-1 classifier + extractor. Mirrors the 8 SMS kinds used by Indian parsers. */
export function parseSms(raw: string): ParsedSms {
  const s = raw.replace(/\s+/g, " ").trim();
  const base: ParsedSms = { ok: false, smsKind: "unknown", raw: s };
  if (!s) return base;
  if (/\b(otp|one time password|verification code)\b/i.test(s)) return { ...base, smsKind: "otp" };
  if (/(offer|cashback upto|pre-approved|click here|win |apply now)/i.test(s) && !/debited|credited/i.test(s))
    return { ...base, smsKind: "promo" };

  const amount = parseAmount(s);
  if (amount === undefined) return base;

  const bank = detectBank(s);
  const date = parseDate(s);
  const vpaM = s.match(/\b([a-z0-9._-]+@[a-z]+)\b/i);
  const vpa = vpaM ? vpaM[1].toLowerCase() : undefined;
  const refM = s.match(/(?:ref(?:\s*no)?|upi(?:\s*ref)?|rrn|txn\s*id)[\s.:#-]*([a-z0-9]{6,})/i);
  const ref = refM ? refM[1] : undefined;

  let smsKind: SmsKind = "unknown";
  let dir: Dir = "debit";
  let kind: Kind = "other";

  if (/reversed|refund/i.test(s)) { smsKind = "refund"; dir = "credit"; kind = "refund"; }
  else if (/auto[- ]?debit|nach|mandate|autopay|e-?mandate|standing instruction/i.test(s)) { smsKind = "autodebit"; dir = "debit"; kind = "autodebit"; }
  else if (/credited|received|deposited/i.test(s) && !/debited/i.test(s.split(/credited|received/i)[0])) {
    dir = "credit"; smsKind = vpa || /upi/i.test(s) ? "upi_credit" : "credit"; kind = vpa || /upi/i.test(s) ? "upi" : "neft";
  } else if (/card.*(used|spent|txn)|spent.*card|(credit|debit) card/i.test(s)) { smsKind = "card"; kind = "card"; }
  else if (/debited|paid|sent|withdrawn|spent|dr\b/i.test(s)) {
    smsKind = vpa || /upi/i.test(s) ? "upi_debit" : "debit"; kind = vpa || /upi/i.test(s) ? "upi" : /atm|withdrawn/i.test(s) ? "atm" : "other";
  } else return base;

  // merchant: "at X", "to X", "towards X", "by X", "from X"
  let merchant = "";
  const mm =
    s.match(/\b(?:at|towards|info:?|to)\s+([A-Za-z0-9*&'._ -]{3,40}?)(?:\s+on\b|\s+ref\b|\.|,|\s+avl|\s+upi|\s+for\b|$)/i) ||
    s.match(/\b(?:by|from)\s+([A-Za-z0-9*&'._ -]{3,40}?)(?:\s+on\b|\.|,|\s+ref|\s+avl|$)/i);
  if (mm) merchant = mm[1].trim();
  if (/a\/c|acct|account|xx\d+|\*\*\d+/i.test(merchant)) merchant = "";
  if (/salary|sal cr|payroll/i.test(s)) merchant = "Salary " + (merchant || "");

  return {
    ok: true, smsKind, amount, dir, kind, date, vpa, ref, bank,
    merchant: prettyMerchant(merchant || (vpa ?? ""), vpa),
    raw: s,
  };
}

export function splitSms(text: string): string[] {
  // one SMS per non-empty line, or blocks separated by blank lines
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks.map((b) => b.replace(/\n/g, " "));
  return text.split(/\n/).map((l) => l.trim()).filter(Boolean);
}

export function dedupeKey(t: Pick<Txn, "amount" | "date" | "ref" | "dir">) {
  return t.ref ? `ref:${t.ref}` : `${t.date}|${t.amount}|${t.dir}`;
}

/** Bank CSV rows -> partial txns. Handles HDFC/ICICI/SBI style headers. */
export function parseCsvRows(rows: Record<string, string>[]): ParsedSms[] {
  const out: ParsedSms[] = [];
  for (const r of rows) {
    const keys = Object.keys(r);
    const k = (re: RegExp) => keys.find((x) => re.test(x));
    const dK = k(/date/i), nK = k(/narration|description|particulars|remarks|details/i);
    const wK = k(/withdrawal|debit|dr\b/i), cK = k(/deposit|credit|cr\b/i), aK = k(/^amount/i);
    if (!dK || !nK) continue;
    const narr = r[nK] ?? "";
    const w = parseFloat((wK ? r[wK] : "").replace(/,/g, "")) || 0;
    const c = parseFloat((cK ? r[cK] : "").replace(/,/g, "")) || 0;
    let amount = w || c;
    let dir: Dir = w ? "debit" : "credit";
    if (!amount && aK) {
      const a = parseFloat(r[aK].replace(/,/g, ""));
      amount = Math.abs(a); dir = a < 0 ? "debit" : "credit";
    }
    if (!amount) continue;
    const vpaM = narr.match(/([a-z0-9._-]+@[a-z]+)/i);
    const vpa = vpaM?.[1].toLowerCase();
    out.push({
      ok: true, smsKind: dir === "debit" ? "debit" : "credit", amount, dir,
      kind: /upi/i.test(narr) ? "upi" : /nach|ach|si-/i.test(narr) ? "autodebit" : "neft",
      date: parseDate(r[dK]), vpa, merchant: prettyMerchant(narr.replace(/^upi[-/]/i, "").replace(/^(neft|imps|rtgs)([ /](cr|dr))?[-/ ]+/i, "").replace(/^(refund|reversal)[-/ ]+/i, "").split(/[-/]/)[0] || narr, vpa),
      raw: narr,
    });
  }
  return out;
}

/** Deterministic fallback for statement rows: "13/11/26 NARRATION 90.00 98210.40" */
export function parseStatementLine(line: string): ParsedSms | null {
  const m = line.match(/^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
  if (!m) return null;
  const narr = m[2];
  const amount = parseFloat(m[3].replace(/,/g, ""));
  const credit = /\bCR\b|refund|reversal|imps-p2p|received|salary|deposit/i.test(narr);
  const vpaM = narr.match(/([a-z0-9._-]+@[a-z]+)/i);
  const vpa = vpaM?.[1].toLowerCase();
  const kind: Kind = /upi/i.test(narr) ? "upi" : /pos|card/i.test(narr) ? "card" : /ach|nach|si-/i.test(narr) ? "autodebit" : "neft";
  const name = narr.replace(/^(upi|pos \S+|ach d-|imps-p2p)[-\s]*/i, "").split(/-|@/)[0];
  return { ok: true, smsKind: credit ? "credit" : "debit", amount, dir: credit ? "credit" : "debit", kind, date: parseDate(m[1]), vpa, merchant: prettyMerchant(name, vpa), raw: line };
}
