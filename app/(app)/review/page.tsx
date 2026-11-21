"use client";
import Wrapped from "@/components/Wrapped";
import { useState } from "react";
import { TraceButton } from "@/components/Shell";
import { CatIcon, GoalIcon } from "@/components/Icons";
import { agentContext, ai, useStore } from "@/lib/store";
import { chaiLeak, detectRecurring, healthScore, inr, monthLabel, monthStats, simulate, BASE } from "@/lib/twin";
import type { AppState } from "@/lib/types";

function md(s: string) {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const inline = (x: string) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  for (const line of s.split("\n")) {
    const l = line.trim();
    const ul = l.match(/^[-*]\s+(.*)/), ol = l.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const t = ul ? "ul" : "ol";
      if (list !== t) { if (list) out.push(`</${list}>`); out.push(`<${t}>`); list = t; }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list}>`); list = null; }
    if (/^#{1,3}\s/.test(l)) out.push(`<h2>${inline(l.replace(/^#+\s/, ""))}</h2>`);
    else if (l) out.push(`<p>${inline(l)}</p>`);
  }
  if (list) out.push(`</${list}>`);
  return out.join("");
}

function templateReview(state: AppState, month: string) {
  const s = monthStats(state, month);
  const leak = chaiLeak(state);
  const recs = detectRecurring(state).filter((r) => r.status !== "active");
  const proj = simulate(state, BASE);
  const roast = state.voice === "roast";
  const over = Object.entries(s.cats).map(([k, v]) => ({ k, v, d: v - (s.avg[k] ?? v) })).sort((a, b) => b.d - a.d);
  return `## The vibe
${roast ? `${monthLabel(month)} was giving "I deserve this" energy.` : `${monthLabel(month)} was solid, honestly!`} You brought in ${inr(s.inc)}, spent ${inr(s.out)} and kept ${inr(s.saved)}.

## Wins 
- SIP of ₹5,000 went out on autopilot, future you says thanks
- Rent, EMI and bills all paid on time
- ${over[over.length - 1].k} came in ${inr(Math.abs(over[over.length - 1].d))} under your usual

## Leaks 
- ${over[0].k}: ${inr(over[0].v)} (${inr(Math.max(over[0].d, 0))} over your 3-month average)
- Chai leak: ${leak.count} tiny UPI payments ≈ ${inr(leak.monthly)}
- Most-visited: ${s.topMerchant?.[0]} (${s.topMerchant?.[1]} times) ${roast ? "" : ""}

## Subscriptions check
${recs.map((r) => `- ${r.merchant}: ${r.note}`).join("\n") || "- All subscriptions look used and stable"}

## Goal runway
${proj.goals.map((g) => `- ${g.goal.name}: ${g.onTrack ? "on track" : "running late"} (ETA ${new Date(g.eta).toLocaleDateString("en-IN", { month: "short", year: "numeric" })})`).join("\n")}

## Next month's 3 moves
1. Cap food delivery at 9 orders (≈ ₹1,500 saved → Goa ~12 days sooner)
2. Halve the chai leak (≈ ${inr(leak.monthly / 2)} saved)
3. Cancel Cult.fit if you're not going (₹1,499/month back)`;
}

export default function Review() {
  const { state, update, addTrace } = useStore();
  const [month, setMonth] = useState("2026-10");
  const [busy, setBusy] = useState(false);
  const [play, setPlay] = useState(false);
  const s = monthStats(state, month);
  const hs = healthScore(state);
  const leak = chaiLeak(state);
  const review = state.review?.month === month ? state.review : null;

  const gen = async () => {
    setBusy(true);
    const ctx = agentContext(state);
    const stats = { month, income: s.inc, spent: s.out, saved: s.saved, byCategory: Object.fromEntries(Object.entries(s.cats).map(([k, v]) => [k, Math.round(v)])), threeMonthAvg: ctx.avg, topMerchant: s.topMerchant, biggestSpend: s.biggest && { merchant: s.biggest.merchant, amount: s.biggest.amount }, count: s.count, chaiLeakMonthly: ctx.leak };
    const goals = simulate(state, BASE).goals.map((g) => ({ name: g.goal.name, target: g.goal.date, eta: g.eta, onTrack: g.onTrack }));
    const r = await ai<string>("review", { stats, ctx: { ...ctx.twin, goalsRunway: goals, recurring: ctx.recurring }, voice: state.voice });
    const text = r.data || templateReview(state, month);
    const traceId = addTrace(`Monthly review: ${monthLabel(month)}`, r.trace.length ? r.trace : [{ agent: "Reviewer", action: "Template review" }]);
    update((st) => ({ ...st, review: { month, text, traceId } }));
    setBusy(false);
  };

  const FIXED = ["Rent", "EMI", "SIP/Investments", "Family transfers", "Bills & utilities"];
  const top = s.top.find(([k]) => !FIXED.includes(k));
  const wrappedBg = "#111114";

  return (
    <div className="grid stagger" style={{ gap: 22 }}>
      <div className="row between wrap">
        <div>
          <h1>Monthly Review</h1>
          <p className="muted">Your month, reviewed by an agent that actually read every transaction.</p>
        </div>
        <div className="row">
          {["2026-08", "2026-09", "2026-10"].map((m) => (
            <button key={m} className={`btn sm ${month === m ? "yellow" : "ghost"}`} onClick={() => setMonth(m)}>{monthLabel(m)}</button>
          ))}
        </div>
      </div>

      <div className="grid g4">
        {[
          { k: "In", v: inr(s.inc), bg: "var(--card)" },
          { k: "Out", v: inr(s.out), bg: "var(--card)" },
          { k: "Kept", v: inr(s.saved), bg: "var(--card)" },
          { k: "Transactions", v: String(s.count), bg: "var(--card)" },
        ].map((c) => <div key={c.k} className="card pop" style={{ background: c.bg, color: "var(--ink)" }}><div className="small" style={{ fontWeight: 600 }}>{c.k}</div><div className="big">{c.v}</div></div>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
        <div className="card">
          <div className="row between wrap">
            <h2>The review</h2>
            <div className="row">
              {review?.traceId && <TraceButton id={review.traceId} />}
              <button className="btn sm purple" onClick={gen} disabled={busy}>{busy ? "writing…" : review ? "Regenerate" : "Generate review "}</button>
            </div>
          </div>
          {review ? <div className="md popin" dangerouslySetInnerHTML={{ __html: md(review.text) }} /> : (
            <p className="muted" style={{ marginTop: 20 }}>Hit generate. The Reviewer agent pulls stats, subscriptions and goal runway, then writes it in your coach voice ({state.voice === "roast" ? "roast 🔥" : "hype 💜"}).</p>
          )}
        </div>

        <div>
          <button className="w-poster" onClick={() => setPlay(true)} aria-label="Play your Paisa Wrapped">
            <div className="w-kicker">Paisa Wrapped · {monthLabel(month)}</div>
            <div className="w-huge">Your month,<br />as a story.</div>
            <div className="w-poster-stack" aria-hidden><span>☕</span><span>🛵</span><span>✨</span></div>
            <span className="w-play">▶ Play your Wrapped</span>
          </button>
          {play && <Wrapped state={state} month={month} onClose={() => setPlay(false)} />}
          <p className="small muted" style={{ marginTop: 10 }}>Screenshot-ready for your story or LinkedIn post.</p>
        </div>
      </div>
    </div>
  );
}
