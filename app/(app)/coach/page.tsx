"use client";
import { useEffect, useRef, useState } from "react";
import { TraceButton } from "@/components/Shell";
import MicButton from "@/components/MicButton";
import { Send } from "lucide-react";
import { agentContext, ai, useStore } from "@/lib/store";

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
    const reply = r.data?.text || "Oops, my brain lagged Try again?";
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

  return (
    <div className="grid stagger" style={{ gap: 18, maxWidth: 860 }}>
      <div className="row between wrap">
        <div>
          <h1>Coach</h1>
          <p className="muted">Ask anything, English or Hinglish. Every number comes from your Money Twin.</p>
        </div>
        <div className="row">
          <button className={`btn sm ${state.voice === "roast" ? "purple" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "roast" }))}>Roast me</button>
          <button className={`btn sm ${state.voice === "hype" ? "purple" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "hype" }))}>Hype me</button>
        </div>
      </div>

      <div className="card" style={{ minHeight: 380, display: "flex", flexDirection: "column", gap: 12 }}>
        {state.chat.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
                        <h3>What&apos;s the money question, {state.profile.name}?</h3>
            <p className="muted small">I can check spends, run what-ifs, and remember life stuff. I won&apos;t give stock tips though, I&apos;m not your WhatsApp uncle</p>
          </div>
        )}
        {state.chat.map((m, i) => (
          <div key={i} className={m.role === "user" ? "bubble-user" : "bubble-ai"} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
            <div style={{
              background: m.role === "user" ? "var(--purple)" : m.guardrail ? "color-mix(in srgb, var(--red) 14%, var(--card))" : "var(--bg)",
              color: m.role === "user" ? "#fff" : "var(--ink)", border: "var(--line)", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "10px 14px", boxShadow: "none", whiteSpace: "pre-wrap", lineHeight: 1.5,
            }}>
              {m.guardrail && <div className="chip red" style={{ marginBottom: 6 }}>guardrail: no stock tips</div>}
              {m.text}
            </div>
            {m.traceId && <div style={{ marginTop: 6 }}><TraceButton id={m.traceId} /></div>}
          </div>
        ))}
        {busy && <div className="small muted">thinking… checking your Twin, running numbers</div>}
        <div ref={end} />
      </div>

      <div className="row wrap" style={{ gap: 6 }}>
        {PROMPTS.map((p) => <button key={p} className="chip" style={{ cursor: "pointer" }} onClick={() => send(p)}>{p}</button>)}
      </div>
      <form className="row wrap chatbar" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask, or tap the mic to speak" style={{ flex: "1 1 240px" }} />
        <MicButton onText={setInput} onFinal={(t) => send(t)} />
        <button className="btn" disabled={busy}><Send size={16} />Send</button>
      </form>
      {state.chat.length > 0 && <button className="btn sm ghost" style={{ justifySelf: "start" }} onClick={() => update((s) => ({ ...s, chat: [] }))}>clear chat</button>}
    </div>
  );
}
