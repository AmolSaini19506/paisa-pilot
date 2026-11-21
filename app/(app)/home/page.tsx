"use client";
import Link from "next/link";
import { CatIcon, GoalIcon, Ico } from "@/components/Icons";
import { Coffee, Inbox, MessageCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { avgByCategory, chaiLeak, computeTwin, daysGainedOnGoal, healthScore, inr, nudges, simulate, BASE } from "@/lib/twin";

function Ring({ score }: { score: number }) {
  const r = 44, c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--lime)" : score >= 50 ? "var(--purple)" : "var(--red)";
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`Money health ${score} of 100`} style={{ flexShrink: 0 }}>
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--hair)" strokeWidth="8" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 52 52)" strokeLinecap="round" style={{ transition: "stroke-dasharray .8s cubic-bezier(.22,1,.36,1)" }} />
      <text x="52" y="58" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="500" fontSize="28" fill="var(--ink)">{score}</text>
    </svg>
  );
}

export default function Home() {
  const { state, openTrace } = useStore();
  const tw = computeTwin(state);
  const hs = healthScore(state);
  const ns = nudges(state);
  const leak = chaiLeak(state);
  const proj = simulate(state, BASE);
  const avg = avgByCategory(state.txns);
  const topCats = Object.entries(avg).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const goaIdx = state.goals.findIndex((g) => /goa/i.test(g.name));
  const roast = state.voice === "roast";
  const vibeLine = hs.score >= 70 ? "You're kinda thriving, ngl" : hs.score >= 50 ? "Mid but fixable. We move." : "Okay, we need to talk";

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="muted small">Sat 21 Nov · Bengaluru · {roast ? "Roast mode" : "Hype mode"}</div>
          <h1 style={{ marginTop: 4 }}>November so far</h1>
        </div>
        <div className="row wrap">
          <Link href="/import" className="btn ghost"><Ico i={Inbox} />Paste SMS</Link>
          <Link href="/coach" className="btn purple"><Ico i={MessageCircle} />Ask coach</Link>
        </div>
      </div>

      {state.memoryDiff && (
        <div className="card popin" style={{ background: "var(--tint)", borderColor: "transparent" }}>
          <div className="row between wrap">
            <h3 style={{ color: "var(--purple)" }}>Money Twin updated</h3>
            <span className="small muted">{new Date(state.memoryDiff.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }} className="small">{state.memoryDiff.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="grid stats" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 0 }}>
          {[
            { k: "Monthly income", v: inr(tw.income), s: "Salary on the 1st" },
            { k: "Fixed costs", v: inr(tw.fixed), s: `${Math.round((tw.fixed / tw.income) * 100)}% of income` },
            { k: "Monthly surplus", v: inr(tw.surplus), s: "Left to fund goals" },
            { k: "Emergency buffer", v: `${tw.efMonths.toFixed(1)} months`, s: `${inr(state.profile.emergencyFund)} of 6-month target` },
          ].map((c, i) => (
            <div key={c.k} style={{ padding: "16px 20px", borderLeft: i ? "1px solid var(--hair)" : "none" }}>
              <div className="small muted">{c.k}</div>
              <div className="big" style={{ fontSize: 24 }}>{c.v}</div>
              <div className="small muted">{c.s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", gap: 16 }}>
        <div className="card leak">
          <div className="row between"><h2><Ico i={Coffee} /> The Chai Leak</h2><span className="chip">{leak.count} small UPIs a month</span></div>
          <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 14 }}>
            <span className="display" style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--purple)" }}>{inr(leak.perDay)}</span>
            <span className="muted">a day</span>
          </div>
          <div className="small muted">{inr(leak.monthly)} a month in payments under ₹250 you never think about</div>
          <div className="receipt" style={{ margin: "16px 0 4px" }}>
            {leak.by.slice(0, 4).map((b) => (
              <div key={b.name} className="row between small" style={{ padding: "8px 0", borderBottom: "1px dashed var(--hair-strong)" }}>
                <span>{b.name}</span><span className="mono" style={{ fontSize: 13 }}>{b.n}× · {inr(b.amt)}</span>
              </div>
            ))}
          </div>
          {goaIdx >= 0 && (
            <div className="small" style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--lime-wash)" }}>
              Halve it and Goa comes <b>{daysGainedOnGoal(state, goaIdx, leak.monthly / 2)} days sooner</b>. Stop it and it&apos;s <b>{daysGainedOnGoal(state, goaIdx, leak.monthly)} days</b>.
            </div>
          )}
        </div>

        <div className="card">
          <div className="row between"><h2>Money health</h2><span className="small muted">{hs.score >= 70 ? "Thriving" : hs.score >= 50 ? "Fixable" : "Needs work"}</span></div>
          <div className="row" style={{ gap: 16, marginTop: 12 }}>
            <Ring score={hs.score} />
            <div>
              <div style={{ fontWeight: 500 }}>{vibeLine.trim()}</div>
              <div className="small muted" style={{ marginTop: 4 }}>Weakest: {hs.weakest.label}, {hs.weakest.note}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            {hs.parts.map((p) => (
              <div key={p.label} style={{ marginBottom: 10 }}>
                <div className="row between small" style={{ marginBottom: 4 }}><span>{p.label}</span><span className="muted">{p.pts}/{p.max}</span></div>
                <div className="bar"><div style={{ width: `${(p.pts / p.max) * 100}%`, background: p.pts / p.max > 0.66 ? "var(--ink)" : p.pts / p.max > 0.33 ? "var(--muted)" : "var(--red)" }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row between"><h2>Nudges</h2><button className="trace-btn" onClick={() => openTrace("all")}>Agent runs</button></div>
          <div style={{ marginTop: 8 }}>
            {ns.map((n, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--hair)" : "none", display: "flex", gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, flexShrink: 0, background: n.tone === "warn" ? "var(--red)" : "var(--purple)" }} />
                <div><div style={{ fontWeight: 500 }}>{n.title}</div><div className="small muted" style={{ marginTop: 2 }}>{n.body}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row between"><h2>Goals runway</h2><Link href="/goals" className="btn sm ghost">What-if</Link></div>
          {proj.goals.map(({ goal, eta, onTrack }) => (
            <div key={goal.id} style={{ marginTop: 16 }}>
              <div className="row between"><span style={{ fontWeight: 500 }}><GoalIcon id={goal.id} />{goal.name}</span><span className={`chip ${onTrack ? "lime" : "red"}`}>{onTrack ? "On track" : "Late"}</span></div>
              <div className="bar" style={{ marginTop: 8 }}><div style={{ width: `${(goal.saved / goal.target) * 100}%`, background: "var(--purple)" }} /></div>
              <div className="small muted" style={{ marginTop: 6 }}>{inr(goal.saved)} of {inr(goal.target)} · ETA {new Date(eta).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}, target {new Date(goal.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Where it goes</h2>
          <div className="small muted" style={{ marginTop: 2 }}>Average per month</div>
          <div style={{ marginTop: 12 }}>
            {topCats.map(([c, v], i) => (
              <div key={c} style={{ marginBottom: 10 }}>
                <div className="row between small" style={{ marginBottom: 4 }}><span><CatIcon c={c} />{c}</span><span>{inr(v)}</span></div>
                <div className="bar"><div style={{ width: `${(v / topCats[0][1]) * 100}%`, background: i === 0 ? "var(--purple)" : "var(--faint)" }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="row between wrap"><h2>What I remember about you</h2></div>
          <div className="small muted" style={{ marginTop: 2 }}>Episodic memory, used by the planner and nudges</div>
          <div style={{ marginTop: 8 }}>
            {state.facts.map((f) => (
              <div key={f.id} className="small" style={{ padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>{f.text} <span className="muted">· via {f.source}</span></div>
            ))}
            {state.rules.map((r) => (
              <div key={r.id} className="small" style={{ padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
                <span className="chip purple" style={{ marginRight: 6 }}>Rule</span>{r.field} {r.type} <span className="mono">&quot;{r.pattern}&quot;</span> → {r.category} <span className="muted">({r.hits})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
