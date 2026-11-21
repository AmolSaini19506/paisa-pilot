"use client";
import { GoalIcon } from "@/components/Icons";
import { useEffect, useState } from "react";
import { accentFor, setAccentOverride } from "@/lib/accent";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TraceButton } from "@/components/Shell";
import MicButton from "@/components/MicButton";
import { agentContext, ai, useStore } from "@/lib/store";
import { BASE, inr, simulate, type Scenario } from "@/lib/twin";

const SLIDERS: { k: keyof Scenario; label: string; max: number; step: number; unit: string; emoji: string }[] = [
  { k: "foodCut", label: "Order in / dine out less", max: 60, step: 5, unit: "%", emoji: "" },
  { k: "leakCut", label: "Plug the chai leak", max: 100, step: 10, unit: "%", emoji: "" },
  { k: "shoppingCut", label: "Shopping less", max: 60, step: 5, unit: "%", emoji: "" },
  { k: "rentHike", label: "Rent hike from Mar '27", max: 25, step: 1, unit: "%", emoji: "" },
  { k: "incomeHike", label: "Salary hike", max: 40, step: 1, unit: "%", emoji: "" },
  { k: "extraSip", label: "Extra monthly investing", max: 15000, step: 500, unit: "₹", emoji: "" },
  { k: "cancelSubs", label: "Cancel subscriptions", max: 2565, step: 1, unit: "₹", emoji: "" },
];

const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function letterFallback(mode: string, name: string) {
  return mode === "drift"
    ? `Hey ${name},\n\nIt's Nov 2030. Not gonna lie, I'm okay, but I keep thinking about that winter. The Goa trip happened… a year late, and half the gang had moved cities by then. Swiggy got ₹6 lakh out of us over five years. The chai leak alone was a used scooter. Cult.fit charged us for 14 months before we noticed.\n\nThe emergency fund never hit 6 months, so when the 2028 layoffs came, it was stressful. We're fine now, but it didn't have to be this hard.\n\nOne small thing: the tiny stuff is never tiny. Start there.\n\n— You, 2030`
    : `Hey ${name},\n\nIt's Nov 2030 and I'm writing this from a balcony that's actually ours to rent without stress. Goa happened right on time in March '27 and it was everything. The emergency fund hit 6 months by mid-2027, so when work got shaky in 2028 we didn't panic, we just updated the CV.\n\nCutting delivery by a third felt dramatic back then. Turns out we didn't miss it. The laptop got bought in cash, and the money that used to leak into ₹40 UPIs now quietly compounds every month.\n\nProud of you for starting when it felt small.\n\n— You, 2030`;
}

export default function Goals() {
  const { state, update, addTrace } = useStore();
  const [sc, setSc] = useState<Scenario>(BASE);
  const [nl, setNl] = useState("");
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState<{ text: string; traceId: string } | null>(null);
  const [letterBusy, setLetterBusy] = useState<string | null>(null);
  const proj = simulate(state, sc);
  const base = simulate(state, BASE);
  const moodRatio = base.surplus > 0 ? proj.surplus / base.surplus : 0.4;
  useEffect(() => { setAccentOverride(moodRatio); }, [moodRatio]);
  useEffect(() => () => setAccentOverride(null), []);
  const changed = JSON.stringify(sc) !== JSON.stringify(BASE);

  const runNl = async () => {
    if (!nl.trim()) return;
    setBusy(true);
    const r = await ai<Scenario>("scenario", { text: nl });
    const next = { ...BASE, ...(r.data ?? {}) };
    setSc(next);
    const p = simulate(state, next);
    const lines = p.goals.map((g) => `${g.goal.name}: ${g.deltaDays >= 0 ? `${g.deltaDays} days sooner` : `${-g.deltaDays} days later`} (ETA ${fmtD(g.eta)})`);
    const id = addTrace(`What-if: "${nl}"`, [
      ...r.trace,
      { agent: "Planner", action: "simulate() — 24-month cash projection", detail: `monthly surplus ${inr(base.surplus)} → ${inr(p.surplus)}` },
      { agent: "Planner", action: "Read episodic memory", detail: state.facts.map((f) => f.text).join(" | ") },
      { agent: "Planner", action: "Goal ETAs recomputed", detail: lines.join(" | ") },
    ]);
    setExplain({ text: lines.join("\n"), traceId: id });
    setBusy(false);
  };

  const letter = async (mode: "plan" | "drift") => {
    setLetterBusy(mode);
    const ctx = agentContext(state);
    const r = await ai<string>("letter", { ctx: ctx.twin, mode });
    const text = r.data || letterFallback(mode, state.profile.name);
    update((s) => ({ ...s, letter: { text, mode } }));
    addTrace(`Future You letter (${mode})`, r.trace.length ? r.trace : [{ agent: "Storyteller", action: "Template letter" }]);
    setLetterBusy(null);
  };

  return (
    <div className="grid stagger" style={{ gap: 22 }}>
      <div>
        <h1>Goals & What-if</h1>
        <p className="muted">Move a slider or just type it. Every goal date reacts live. Rent hike from memory is already priced in</p>
      </div>

      <div className="card" style={{ background: "var(--tint)" }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <input value={nl} onChange={(e) => setNl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runNl()} placeholder='Try: "what if I order in 30% less and get a 10% hike?" or "chai aadha kar du toh?"' style={{ flex: 1, minWidth: 240 }} />
          <MicButton onText={setNl} />
          <button className="btn purple" onClick={runNl} disabled={busy}>{busy ? "simulating…" : "Simulate "}</button>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
          {["what if I order in 30% less and rent goes up 10%?", "cancel cult and halve the chai leak", "10% hike + extra SIP of 5000"].map((s) => (
            <button key={s} className="chip" style={{ cursor: "pointer" }} onClick={() => setNl(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)" }}>
        <div className="card">
          <div className="row between"><h2>Levers</h2>{changed && <button className="btn sm ghost" onClick={() => { setSc(BASE); setExplain(null); }}>reset</button>}</div>
          {SLIDERS.map((s) => (
            <div key={s.k} style={{ marginTop: 14 }}>
              <div className="row between small"><span>{s.label}</span><b>{s.unit === "₹" ? inr(sc[s.k]) : `${sc[s.k]}%`}</b></div>
              <input type="range" min={0} max={s.max} step={s.step} value={sc[s.k]} onChange={(e) => setSc({ ...sc, [s.k]: +e.target.value })} style={{ width: "100%" }} />
            </div>
          ))}
          <div className="card" style={{ marginTop: 16, padding: 12, background: "var(--lime-wash)", color: "var(--ink)", boxShadow: "none" }}>
            Monthly surplus: <b>{inr(base.surplus)}</b> → <b>{inr(proj.surplus)}</b>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Modelling only. Paisa Pilot doesn&apos;t recommend specific investments.</p>
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <div className="grid g3" style={{ gap: 12 }}>
            {proj.goals.map((g) => (
              <div key={g.goal.id} className="card pop popin" style={{ padding: 14, background: "var(--card)" }}>
                <div style={{ color: "var(--muted)" }}><GoalIcon id={g.goal.id} size={20} /></div>
                <div style={{ fontWeight: 600 }}>{g.goal.name}</div>
                <div className="small muted">target {fmtD(g.goal.date)}</div>
                <div style={{ marginTop: 6, fontWeight: 600 }}>ETA {fmtD(g.eta)}</div>
                <span className={`chip ${g.onTrack ? "lime" : "red"}`} style={{ marginTop: 6 }}>{g.onTrack ? "On track" : "Late"}</span>
                {changed && g.deltaDays !== 0 && <div className="small" style={{ marginTop: 6, fontWeight: 600, color: g.deltaDays > 0 ? "var(--green)" : "var(--red)" }}>{g.deltaDays > 0 ? ` ${g.deltaDays} days sooner` : ` ${-g.deltaDays} days later`}</div>}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="row between wrap"><h3>Savings runway (24 months)</h3>{explain && <TraceButton id={explain.traceId} />}</div>
            <div style={{ height: 260, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={proj.series} margin={{ left: 10, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={3} />
                  <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: any) => inr(+v)} />
                  <Legend />
                  <Line type="monotone" dataKey="base" name="Current path" stroke="#6b6b75" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                  <Line type="monotone" dataKey="scenario" name="Your what-if" stroke={accentFor(moodRatio).accent} strokeWidth={4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: "var(--purple)", color: "var(--accent-ink)" }}>
        <div className="row between wrap">
          <div>
            <h2>Letter from Future You (2030)</h2>
            <p style={{ opacity: .85, margin: "4px 0 0" }}>Two timelines. Same you. Pick one to read.</p>
          </div>
          <div className="row wrap">
            <button className="btn" onClick={() => letter("plan")} disabled={!!letterBusy}>{letterBusy === "plan" ? "writing…" : " I stuck to the plan"}</button>
            <button className="btn pink" onClick={() => letter("drift")} disabled={!!letterBusy}>{letterBusy === "drift" ? "writing…" : " I kept drifting"}</button>
          </div>
        </div>
        {state.letter && (
          <div className="card popin" style={{ marginTop: 16, background: "#fffdf5", color: "#222", whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.6, fontFamily: "Georgia, serif", transform: "rotate(-0.6deg)" }}>
            {state.letter.text}
          </div>
        )}
      </div>
    </div>
  );
}
