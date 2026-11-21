"use client";
import Link from "next/link";
import { catColor, catEmoji } from "@/lib/categories";
import { useStore } from "@/lib/store";
import { avgByCategory, chaiLeak, computeTwin, daysGainedOnGoal, healthScore, inr, nudges, simulate, BASE } from "@/lib/twin";

function Ring({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--lime)" : score >= 50 ? "var(--yellow)" : "var(--orange)";
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Money health ${score} of 100`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--bg)" strokeWidth="16" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--ink)" strokeWidth="20" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 66 66)" strokeLinecap="round" />
      <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 66 66)" strokeLinecap="round" style={{ transition: "stroke-dasharray .8s" }} />
      <text x="66" y="72" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="34" fill="var(--ink)">{score}</text>
      <text x="66" y="92" textAnchor="middle" fontSize="11" fill="var(--muted)">/ 100</text>
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
  const vibeLine = hs.score >= 70 ? "You're kinda thriving ngl ✨" : hs.score >= 50 ? "Mid but fixable. We move. 💪" : "Okay we need to talk 😭";

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div className="row between wrap">
        <div>
          <div className="muted small" style={{ fontWeight: 700 }}>SAT, 21 NOV · BENGALURU</div>
          <h1>Hey {state.profile.name} 👋 <span className="wiggle" style={{ display: "inline-block" }}>{roast ? "🔥" : "💖"}</span></h1>
          <div className="muted">{roast ? "Roast mode on. Your wallet asked for this." : "Hype mode on. We believe in you."}</div>
        </div>
        <div className="row wrap">
          <Link href="/import" className="btn">📥 Paste SMS</Link>
          <Link href="/coach" className="btn pink">🗣️ Ask coach</Link>
        </div>
      </div>

      {state.memoryDiff && (
        <div className="card popin" style={{ background: "var(--cyan)", color: "#111" }}>
          <div className="row between wrap">
            <h3>🧠 Money Twin updated</h3>
            <span className="small">{new Date(state.memoryDiff.at).toLocaleTimeString("en-IN")}</span>
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{state.memoryDiff.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,2fr)", gap: 18 }}>
        <div className="card pop" style={{ background: "var(--card)" }}>
          <div className="row between"><h3>Money Health</h3><span className="chip">{hs.score >= 70 ? "thriving" : hs.score >= 50 ? "mid" : "help"}</span></div>
          <div className="row" style={{ gap: 16, marginTop: 8 }}>
            <Ring score={hs.score} />
            <div>
              <div style={{ fontWeight: 800 }}>{vibeLine}</div>
              <div className="small muted" style={{ marginTop: 6 }}>Weakest link: <b>{hs.weakest.label}</b> ({hs.weakest.note})</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {hs.parts.map((p) => (
              <div key={p.label} style={{ marginBottom: 7 }}>
                <div className="row between small"><span>{p.label}</span><span className="muted">{p.pts}/{p.max} · {p.note}</span></div>
                <div className="bar"><div style={{ width: `${(p.pts / p.max) * 100}%`, background: p.pts / p.max > 0.66 ? "var(--lime)" : p.pts / p.max > 0.33 ? "var(--yellow)" : "var(--orange)" }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid g2" style={{ gap: 18 }}>
          {[
            { k: "Monthly income", v: inr(tw.income), s: "salary on the 1st 💸", bg: "var(--lime)" },
            { k: "Fixed costs", v: inr(tw.fixed), s: `${Math.round((tw.fixed / tw.income) * 100)}% of income locked`, bg: "var(--yellow)" },
            { k: "Monthly surplus", v: inr(tw.surplus), s: "what's left to fund goals", bg: "var(--pink)" },
            { k: "Emergency buffer", v: `${tw.efMonths.toFixed(1)} mo`, s: `${inr(state.profile.emergencyFund)} saved · target 6 mo`, bg: "var(--cyan)" },
          ].map((c) => (
            <div key={c.k} className="card pop" style={{ background: c.bg, color: "#111" }}>
              <div className="small" style={{ fontWeight: 700 }}>{c.k}</div>
              <div className="big">{c.v}</div>
              <div className="small">{c.s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row between"><h2>Nudges</h2><button className="trace-btn" onClick={() => openTrace("all")}>agent runs 🔍</button></div>
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            {ns.map((n, i) => (
              <div key={i} className="card popin" style={{ padding: 12, boxShadow: "3px 3px 0 var(--ink)", background: n.tone === "warn" ? "color-mix(in srgb, var(--orange) 18%, var(--card))" : "var(--card)", animationDelay: `${i * 80}ms` }}>
                <div style={{ fontWeight: 800 }}>{n.emoji} {n.title}</div>
                <div className="small" style={{ marginTop: 4 }}>{n.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ background: "#2a1a0e", color: "#ffe9c7" }}>
          <div className="row between"><h2>☕ The Chai Leak</h2><span className="chip yellow">{leak.count} tiny UPIs/mo</span></div>
          <div className="big" style={{ marginTop: 10, color: "#ffd36e" }}>{inr(leak.perDay)}/day</div>
          <div>= <b>{inr(leak.monthly)}/month</b> in payments under ₹250 you never think about.</div>
          <div style={{ margin: "14px 0" }}>
            {leak.by.slice(0, 4).map((b) => (
              <div key={b.name} className="row between small" style={{ padding: "4px 0", borderBottom: "1px dashed #ffe9c755" }}>
                <span>{b.name}</span><span>{b.n}× · {inr(b.amt)}</span>
              </div>
            ))}
          </div>
          {goaIdx >= 0 && (
            <div className="card" style={{ background: "#ffd36e", color: "#111", padding: 12, boxShadow: "3px 3px 0 #000" }}>
              Halve it → Goa trip <b>{daysGainedOnGoal(state, goaIdx, leak.monthly / 2)} days sooner</b>. Kill it → <b>{daysGainedOnGoal(state, goaIdx, leak.monthly)} days</b>. 🏖️
            </div>
          )}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row between"><h2>Goals runway</h2><Link href="/goals" className="btn sm yellow">what-if →</Link></div>
          {proj.goals.map(({ goal, eta, onTrack }) => (
            <div key={goal.id} style={{ marginTop: 14 }}>
              <div className="row between"><b>{goal.emoji} {goal.name}</b><span className={`chip ${onTrack ? "lime" : "red"}`}>{onTrack ? "on track" : "late"}</span></div>
              <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${(goal.saved / goal.target) * 100}%`, background: "var(--purple)" }} /></div>
              <div className="small muted" style={{ marginTop: 4 }}>{inr(goal.saved)} / {inr(goal.target)} · target {new Date(goal.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · ETA {new Date(eta).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Where it goes (avg/month)</h2>
          <div style={{ marginTop: 12 }}>
            {topCats.map(([c, v]) => (
              <div key={c} style={{ marginBottom: 8 }}>
                <div className="row between small"><span>{catEmoji(c)} {c}</span><b>{inr(v)}</b></div>
                <div className="bar"><div style={{ width: `${(v / topCats[0][1]) * 100}%`, background: catColor(c) }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row between wrap"><h2>🧠 What I remember about you</h2><span className="small muted">episodic memory · used by planner + nudges</span></div>
        <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
          {state.facts.map((f) => (
            <div key={f.id} className="chip" style={{ padding: "6px 12px", fontSize: 13, whiteSpace: "normal" }}>📌 {f.text} <span className="muted">· via {f.source}</span></div>
          ))}
          {state.rules.map((r) => (
            <div key={r.id} className="chip pink" style={{ padding: "6px 12px", fontSize: 13 }}>🧩 {r.field} {r.type} &quot;{r.pattern}&quot; → {r.category} ({r.hits})</div>
          ))}
        </div>
      </div>
    </div>
  );
}
