"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { initialState } from "./seed";
import type { AppState, Trace, TraceStep } from "./types";
import { avgByCategory, byCategory, chaiLeak, computeTwin, detectRecurring, healthScore, monthLeft } from "./twin";

const KEY = "paisa-pilot-v3";
const AUTH = "paisa-pilot-auth";

interface Ctx {
  state: AppState;
  ready: boolean;
  authed: boolean;
  login: (email: string, pw: string) => Promise<string | null>;
  logout: () => void;
  update: (fn: (s: AppState) => AppState) => void;
  reset: () => void;
  addTrace: (title: string, steps: TraceStep[]) => string;
  toast: (msg: string, emoji?: string) => void;
  toasts: { id: number; msg: string; emoji: string }[];
  traceOpen: string | null;
  openTrace: (id: string | null) => void;
}

const C = createContext<Ctx | null>(null);

export const JUDGE_EMAIL = "judge@paisapilot.app";
export const JUDGE_PW = "chai2026";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; emoji: string }[]>([]);
  const [traceOpen, setTraceOpen] = useState<string | null>(null);
  const tid = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.version === 3) setState({ ...s, txns: (s.txns ?? []).map((t: { raw?: string; merchant: string }) => ({ ...t, raw: "", merchant: t.merchant.replace(/^BharatPe merchant (\d+)$/, "BharatPe $1") })) });
      }
      const tok = localStorage.getItem(AUTH);
      setAuthed(!!tok && tok !== "1");
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const reset = useCallback(() => setState(initialState()), []);
  /** Checks the password on the server and keeps its signed session token. Returns an error message, or null on success. */
  const login = useCallback(async (email: string, pw: string) => {
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) return j.error ?? "Wrong email or password.";
      try { localStorage.setItem(AUTH, j.token); } catch { return "Your browser blocked saving the login. Turn off private mode or allow site data, then try again."; }
      setAuthed(true);
      return null;
    } catch {
      return "Can't reach the server. Check your connection and try again.";
    }
  }, []);
  const logout = useCallback(() => { setAuthed(false); setState(initialState()); try { localStorage.removeItem(AUTH); localStorage.removeItem(KEY); } catch {} }, []);
  const toast = useCallback((msg: string, emoji = "✨") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, msg, emoji }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const addTrace = useCallback((title: string, steps: TraceStep[]) => {
    const id = "t" + Date.now() + Math.random().toString(36).slice(2, 5);
    const tr: Trace = { id, title, at: new Date().toISOString(), steps };
    setState((s) => ({ ...s, traces: [tr, ...s.traces].slice(0, 40) }));
    return id;
  }, []);

  const value = useMemo(
    () => ({ state, ready, authed, login, logout, update, reset, addTrace, toast, toasts, traceOpen, openTrace: setTraceOpen }),
    [state, ready, authed, login, logout, update, reset, addTrace, toast, toasts, traceOpen],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("no store");
  return c;
}

export function authHeaders(h: Record<string, string> = {}): Record<string, string> {
  try { const t = localStorage.getItem(AUTH); if (t) h.authorization = `Bearer ${t}`; } catch {}
  return h;
}

function currentToken(): string | null {
  try { return localStorage.getItem(AUTH); } catch { return null; }
}

/** Log out only if the token that failed is still the current one (a newer login must survive an old 401). */
export function sessionExpired(failedToken: string | null) {
  if (failedToken !== currentToken()) return;
  try { localStorage.removeItem(AUTH); } catch {}
  if (typeof window !== "undefined" && window.location.pathname !== "/") window.location.href = "/";
}

export async function ai<T = any>(task: string, payload: any): Promise<{ data: T; trace: TraceStep[]; llm: boolean; error?: string }> {
  try {
    const token = currentToken();
    const r = await fetch("/api/ai", { method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify({ task, payload }) });
    if (r.status === 401) sessionExpired(token);
    const j = await r.json();
    return { data: j.data, trace: j.trace ?? [], llm: !!j.llm, error: j.error };
  } catch (e: any) {
    return { data: null as any, trace: [{ agent: "System", action: "Network error", detail: e.message }], llm: false, error: e.message };
  }
}

/** Compact context sent to server-side agents (the Money Twin snapshot). */
export function agentContext(state: AppState) {
  const twin = computeTwin(state);
  const hs = healthScore(state);
  const recurring = detectRecurring(state).filter((r) => !state.cancelled.includes(r.merchant)).map((r) => ({ merchant: r.merchant, amount: r.last, status: r.status, note: r.note }));
  // exact per-merchant totals for the latest month, so the coach never passes an average off as a total
  const latest = state.txns.reduce((m, t) => (t.date.slice(0, 7) > m ? t.date.slice(0, 7) : m), "");
  const merchantTotals: Record<string, { total: number; count: number }> = {};
  for (const t of state.txns) if (t.dir === "debit" && t.date.startsWith(latest)) { const e = (merchantTotals[t.merchant] ??= { total: 0, count: 0 }); e.total += t.amount; e.count++; }
  const ranked = Object.entries(merchantTotals).sort((a, b) => b[1].total - a[1].total).map(([merchant, v]) => ({ merchant, total: Math.round(v.total), count: v.count }));
  const months: Record<string, Record<string, number>> = {};
  for (const m of ["2026-08", "2026-09", "2026-10", "2026-11"]) months[m] = round(byCategory(state.txns, m));
  return {
    twin: {
      name: state.profile.name, city: state.profile.city, income: twin.income, fixed: Math.round(twin.fixed),
      fixedItems: twin.fixedItems.map((f) => ({ ...f, amount: Math.round(f.amount) })),
      variable: Math.round(twin.variable), surplus: monthLeft(state).projected, usualSurplus: Math.round(twin.surplus), efMonths: +twin.efMonths.toFixed(1),
      emergencyFund: state.profile.emergencyFund, healthScore: hs.score,
      goals: state.goals, memoryFacts: state.facts.map((f) => f.text),
      recurring,
      cancelledSubscriptions: state.cancelled,
    },
    goals: state.goals,
    avg: round(avgByCategory(state.txns)),
    months,
    leak: Math.round(chaiLeak(state).monthly),
    recurring,
    merchantsThisMonth: { month: latest, top: ranked.slice(0, 25), all: ranked },
  };
}
function round(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
}
