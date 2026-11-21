"use client";
import { useEffect, useRef, useState } from "react";
import { TraceButton } from "@/components/Shell";
import MicButton from "@/components/MicButton";
import { ArrowUpRight, Send } from "lucide-react";
import { computeTwin, inr } from "@/lib/twin";
import { agentContext, ai, useStore } from "@/lib/store";

const SUGGEST = [
  { e: "🏝️", t: "Can I afford Goa?", q: "Bhai, Goa trip affordable hai?" },
  { e: "🍔", t: "Cut food delivery", q: "What if I cut Swiggy by a third?" },
  { e: "🏠", t: "Rent is going up", q: "My rent is going up to ₹28k from March, remember that" },
  { e: "📊", t: "Explain my month", q: "Explain my month in 3 lines" },
];

const PROMPTS = [
  "Bhai, Goa trip affordable hai?",
  "Which stock should I buy with my savings?",
  "What if I cut Swiggy by a third?",
  "My rent is going up to ₹28k from March, remember that",
  "Explain my month in 3 lines",
];

export default function Coach() {
  const { state, update, addTrace } = useStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [state.chat.length, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const msgs = [...state.chat, { role: "user" as const, text }];
    update((s) => ({ ...s, chat: msgs }));
    setInput("");
    setBusy(true);
    const r = await ai<{ text: string; guardrail: boolean; facts: { fact: string; date?: string }[] }>("coach", {
      messages: msgs.slice(-10).map((m) => ({ role: m.role, text: m.text })), ctx: agentContext(state), voice: state.voice,
    });
    const reply = r.data?.text || "Oops, my brain lagged. Try again?";
    const facts = r.data?.facts ?? [];
    const steps = [...r.trace];
    if (facts.length) steps.push({ agent: "Coach", action: `Wrote ${facts.length} fact(s) to episodic memory`, detail: facts.map((f) => f.fact).join(" | ") });
    const traceId = addTrace(`Coach: "${text.slice(0, 40)}"`, steps);
    update((s) => ({
      ...s,
      chat: [...msgs, { role: "assistant", text: reply, guardrail: r.data?.guardrail, traceId }],
      facts: [...s.facts, ...facts.map((f, i) => ({ id: "f" + Date.now() + i, text: f.fact, date: f.date, source: "coach chat", createdAt: new Date().toISOString() }))],
      memoryDiff: facts.length ? { at: new Date().toISOString(), lines: facts.map((f) => `Remembered: ${f.fact}`) } : s.memoryDiff,
    }));
    setBusy(false);
  };

  const tw = computeTwin(state);
  const txCount = state.txns.length;
  const rich = (t: string) => t.split(/(₹\s?[\d,]+(?:\.\d+)?(?:\s?(?:lakh|k|L))?|\d+\s?days?|\d{1,3}%)/g).map((p, k) => k % 2 ? <b key={k} className="num-hl">{p}</b> : p);

  return (
    <div className="coach">
      <header className="coach-head">
        <div className="row" style={{ gap: 12 }}>
          <div className="coach-avatar" aria-hidden>✈️</div>
          <div>
            <div className="coach-name">Pilot <span className="live-dot" aria-hidden /></div>
            <div className="muted small">Your money coach · reads all {txCount} transactions · Hinglish is fine</div>
          </div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Coach voice" style={{ minWidth: 220 }}>
          <button role="radio" aria-checked={state.voice === "roast"} onClick={() => update((s) => ({ ...s, voice: "roast" }))}>🔥 Roast me</button>
          <button role="radio" aria-checked={state.voice === "hype"} onClick={() => update((s) => ({ ...s, voice: "hype" }))}>💜 Hype me</button>
        </div>
      </header>

      <div className="coach-context">
        <span>Left this month <b>{inr(tw.surplus)}</b></span>
        <span>Buffer <b>{tw.efMonths.toFixed(1)} mo</b></span>
        <span>Goals <b>{state.goals.length}</b></span>
        <span>Memories <b>{state.facts.length}</b></span>
        {state.chat.length > 0 && <button className="link-btn" onClick={() => update((s) => ({ ...s, chat: [] }))}>New chat</button>}
      </div>

      <div className="thread">
        {state.chat.length === 0 && (
          <div className="coach-empty">
            <h2 style={{ fontSize: 26 }}>What&apos;s the money question, {state.profile.name}?</h2>
            <p className="muted">I check your real spends, run what-ifs and remember life stuff. No stock tips, I&apos;m not your WhatsApp uncle.</p>
            <div className="suggest">
              {SUGGEST.map((p) => (
                <button key={p.q} className="suggest-item" onClick={() => send(p.q)}>
                  <span className="suggest-emoji">{p.e}</span>
                  <span><b>{p.t}</b><span className="muted small">{p.q}</span></span>
                  <ArrowUpRight size={16} className="suggest-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}
        {state.chat.map((m, i) => m.role === "user" ? (
          <div key={i} className="msg-user bubble-user">{m.text}</div>
        ) : (
          <div key={i} className="msg-ai bubble-ai">
            <div className="coach-avatar sm" aria-hidden>✈️</div>
            <div style={{ minWidth: 0 }}>
              <div className="msg-meta">Pilot{m.guardrail && <span className="guard">🛡️ Guardrail · no stock tips</span>}</div>
              <div className="msg-body">{rich(m.text)}</div>
              {m.traceId && <div style={{ marginTop: 8 }}><TraceButton id={m.traceId} /></div>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg-ai bubble-ai">
            <div className="coach-avatar sm" aria-hidden>✈️</div>
            <div className="typing"><i /><i /><i /><span className="muted small">checking your Twin, running numbers</span></div>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="composer-wrap">
        {state.chat.length > 0 && (
          <div className="quick-asks">{PROMPTS.map((p) => <button key={p} onClick={() => send(p)}>{p}</button>)}</div>
        )}
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Pilot anything, or tap the mic" aria-label="Message Pilot" />
          <MicButton onText={setInput} onFinal={(t) => send(t)} />
          <button className="send-btn" disabled={busy || !input.trim()} aria-label="Send"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
