"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { initialState } from "./seed";
import type { AppState, Trace, TraceStep } from "./types";
import { avgByCategory, byCategory, chaiLeak, computeTwin, detectRecurring, healthScore } from "./twin";

const KEY = "paisa-pilot-v3";
const AUTH = "paisa-pilot-auth";

interface Ctx {
  state: AppState;
  ready: boolean;
  authed: boolean;
  login: (email: string, pw: string) => boolean;
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
        if (s.version === 3) setState(s);
      }
      setAuthed(localStorage.getItem(AUTH) === "1");
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const reset = useCallback(() => setState(initialState()), []);
  const login = useCallback((email: string, pw: string) => {
    const ok = email.trim().toLowerCase() === JUDGE_EMAIL && pw === JUDGE_PW;
    if (ok) { setAuthed(true); try { localStorage.setItem(AUTH, "1"); } catch {} }
    return ok;
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

export async function ai<T = any>(task: string, payload: any): Promise<{ data: T; trace: TraceStep[]; llm: boolean; error?: string }> {
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, payload }) });
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
  const months: Record<string, Record<string, number>> = {};
  for (const m of ["2026-08", "2026-09", "2026-10", "2026-11"]) months[m] = round(byCategory(state.txns, m));
  return {
    twin: {
      name: state.profile.name, city: state.profile.city, income: twin.income, fixed: Math.round(twin.fixed),
      fixedItems: twin.fixedItems.map((f) => ({ ...f, amount: Math.round(f.amount) })),
      variable: Math.round(twin.variable), surplus: Math.round(twin.surplus), efMonths: +twin.efMonths.toFixed(1),
      emergencyFund: state.profile.emergencyFund, healthScore: hs.score,
      goals: state.goals, memoryFacts: state.facts.map((f) => f.text),
      recurring: detectRecurring(state).map((r) => ({ merchant: r.merchant, amount: r.last, status: r.status, note: r.note })),
    },
    goals: state.goals,
    avg: round(avgByCategory(state.txns)),
    months,
    leak: Math.round(chaiLeak(state).monthly),
    recurring: detectRecurring(state).map((r) => ({ merchant: r.merchant, amount: r.last, status: r.status, note: r.note })),
  };
}
function round(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
}
