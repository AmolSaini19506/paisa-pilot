"use client";
import Link from "next/link";
import Tilt from "@/components/Tilt";
import { CatIcon, GoalIcon, Ico } from "@/components/Icons";
import { CalendarRange, Coffee, Inbox, MessageCircle, ReceiptText, Repeat, Target } from "lucide-react";
import { Num, useSpring } from "@/components/Motion";
import { useStore } from "@/lib/store";
import { monthLeft, avgByCategory, chaiLeak, computeTwin, daysGainedOnGoal, healthScore, inr, nudges, simulate, BASE } from "@/lib/twin";

function Ring({ score: target }: { score: number }) {
  const score = useSpring(target, 0.9);
  const r = 44, c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--lime)" : score >= 50 ? "var(--purple)" : "var(--red)";
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`Money health ${target} of 100`} style={{ flexShrink: 0 }}>
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--hair)" strokeWidth="8" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 52 52)" strokeLinecap="round" />
      <text x="52" y="58" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="500" fontSize="28" fill="var(--ink)">{Math.round(score)}</text>
    </svg>
  );
}

export default function Home() {
  const { state, openTrace } = useStore();
  const tw = computeTwin(state);
  const ml = monthLeft(state);
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
    <div className="grid stagger" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ alignItems: "center", gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="avatar">{state.profile.name[0]}</div>
          <div>
            <div className="muted small">Sat 21 Nov · Bengaluru</div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>Hey {state.profile.name}, {roast ? "roast mode is on 🔥" : "hype mode is on 💜"}</div>
          </div>
        </div>
      </div>

      <div className="hero-row">
        <Tilt className="money-card">
          <div className="row between">
            <span className="mc-label">Left to spend this month</span>
            <span className="mc-brand">paisa<b>pilot</b></span>
          </div>
          <div className="mc-amount"><Num value={ml.projected} format={inr} /></div>
          <div className="mc-sub">projected at this month's pace · you usually have {inr(ml.usual)} left</div>
          <div className="mc-foot">
            <div><span>In</span><b><Num value={tw.income} format={inr} /></b></div>
            <div><span>Fixed</span><b><Num value={tw.fixed} format={inr} /></b></div>
            <div><span>Buffer</span><b>{tw.efMonths.toFixed(1)} mo</b></div>
          </div>
          <span className="mc-sticker" aria-hidden>🪙</span>
        </Tilt>
        <div className="quick">
          {[
            { href: "/import", icon: Inbox, label: "Paste SMS" },
            { href: "/coach", icon: MessageCircle, label: "Ask coach" },
            { href: "/goals", icon: Target, label: "What-if" },
            { href: "/subs", icon: Repeat, label: "Subs" },
            { href: "/txns", icon: ReceiptText, label: "Spends" },
            { href: "/review", icon: CalendarRange, label: "Review" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="q-item"><span className="q-ico"><q.icon size={22} strokeWidth={1.9} /></span>{q.label}</Link>
          ))}
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

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", gap: 16 }}>
        <div className="card leak">
          <div className="row between"><h2><span className="sticker-emoji">☕</span> The Chai Leak</h2><span className="chip">{leak.count} small UPIs a month</span></div>
          <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 14 }}>
            <span className="display" style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--purple)" }}><Num value={leak.perDay} format={inr} /></span>
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
          <div className="row between"><h2><span className="sticker-emoji">🩺</span> Money health</h2><span className="small muted">{hs.score >= 70 ? "Thriving" : hs.score >= 50 ? "Fixable" : "Needs work"}</span></div>
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

      <div className="grid g2 lower">
        <section className="open">
          <div className="row between"><h2><span className="sticker-emoji">👀</span> Nudges</h2><button className="trace-btn" onClick={() => openTrace("all")}>Agent runs</button></div>
          <div style={{ marginTop: 8 }}>
            {ns.map((n, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--hair)" : "none", display: "flex", gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, flexShrink: 0, background: n.tone === "warn" ? "var(--red)" : "var(--purple)" }} />
                <div><div style={{ fontWeight: 500 }}>{n.title}</div><div className="small muted" style={{ marginTop: 2 }}>{n.body}</div></div>
              </div>
            ))}
          </div>
        </section>
        <section className="open">
          <div className="row between"><h2><span className="sticker-emoji">🏝️</span> Goals runway</h2><Link href="/goals" className="btn sm ghost">What-if</Link></div>
          {proj.goals.map(({ goal, eta, onTrack }) => (
            <div key={goal.id} style={{ marginTop: 16 }}>
              <div className="row between"><span style={{ fontWeight: 500 }}><GoalIcon id={goal.id} />{goal.name}</span><span className={`chip ${onTrack ? "lime" : "red"}`}>{onTrack ? "On track" : "Late"}</span></div>
              <div className="bar" style={{ marginTop: 8 }}><div style={{ width: `${(goal.saved / goal.target) * 100}%`, background: "var(--purple)" }} /></div>
              <div className="small muted" style={{ marginTop: 6 }}>{inr(goal.saved)} of {inr(goal.target)} · ETA {new Date(eta).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}, target {new Date(goal.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
            </div>
          ))}
        </section>
      </div>

      <div className="grid g2 lower">
        <section className="open">
          <h2><span className="sticker-emoji">💸</span> Where it goes</h2>
          <div className="small muted" style={{ marginTop: 2 }}>Average per month</div>
          <div style={{ marginTop: 12 }}>
            {topCats.map(([c, v], i) => (
              <div key={c} style={{ marginBottom: 10 }}>
                <div className="row between small" style={{ marginBottom: 4 }}><span><CatIcon c={c} />{c}</span><span>{inr(v)}</span></div>
                <div className="bar"><div style={{ width: `${(v / topCats[0][1]) * 100}%`, background: i === 0 ? "var(--purple)" : "var(--faint)" }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="open">
          <div className="row between wrap"><h2><span className="sticker-emoji">🧠</span> What I remember about you</h2></div>
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
        </section>
      </div>
    </div>
  );
}
