"use client";
import { useEffect, useState } from "react";
import { CatIcon } from "@/components/Icons";
import { useStore } from "@/lib/store";
import { days, daysGainedOnGoal, goalsStuck, detectRecurring, inr } from "@/lib/twin";

export default function Subs() {
  const { state, update, toast } = useStore();
  const recs = detectRecurring(state);
  const subs = recs.filter((r) => r.category === "Subscriptions");
  const fixed = recs.filter((r) => r.category !== "Subscriptions");
  const graveyard = subs.filter((r) => state.cancelled.includes(r.merchant));
  const alive = subs.filter((r) => !state.cancelled.includes(r.merchant));
  const monthly = alive.reduce((a, r) => a + r.last, 0);
  const goa = state.goals.findIndex((g) => /goa/i.test(g.name));

  const [confirm, setConfirm] = useState<string | null>(null);
  // one timer per armed confirmation; re-arming or unmounting clears the old one
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(null), 4000); return () => clearTimeout(t); }, [confirm]);
  const bury = (m: string, amt: number, due: string) => {
    if (confirm !== m) { setConfirm(m); return; }
    setConfirm(null);
    update((s) => ({ ...s, cancelled: [...s.cancelled, m], memoryDiff: { at: new Date().toISOString(), lines: [`${m} marked for cancellation → ${inr(amt * 12)}/year freed`, `Reminder: cancel inside the app before the ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} renewal`] } }));
    toast(`RIP ${m}. Cancel it in the ${m} app before ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} and ${inr(amt * 12)}/year is yours again. Badge unlocked: Subscription Slayer`, "");
  };

  return (
    <div className="grid stagger" style={{ gap: 22 }}>
      <div className="row between wrap">
        <div>
          <h1>Subscriptions</h1>
          <p className="muted">Auto-detected from 28–31 day patterns, NACH/AutoPay mandates and card repeats.</p>
        </div>
        <div className="card" style={{ background: "var(--tint)", padding: "10px 16px" }}>
          <div className="small" style={{ fontWeight: 600 }}>Subscriptions burn</div>
          <div className="big">{inr(monthly)}/mo</div>
          <div className="small">{inr(monthly * 12)} a year</div>
        </div>
      </div>

      <div className="grid g3">
        {alive.map((r) => (
          <div key={r.merchant} className="card pop" style={{ borderColor: r.status !== "active" ? "var(--red)" : undefined, background: r.status === "unused" ? "color-mix(in srgb, var(--red) 12%, var(--card))" : r.status === "price_changed" ? "color-mix(in srgb, var(--red) 15%, var(--card))" : undefined }}>
            <div className="row between">
              <h3><CatIcon c={r.category} />{r.merchant}</h3>
              {r.status === "unused" && <span className="chip red">unused</span>}
              {r.status === "price_changed" && <span className="chip yellow">plan went up</span>}
              {r.status === "active" && <span className="chip lime">active</span>}
            </div>
            <div className="big" style={{ marginTop: 6 }}>{inr(r.last)}<span className="small muted">/mo</span></div>
            <div className="small muted">next ~{new Date(r.nextDue).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {inr(r.yearly)}/yr</div>
            {/* sparkline of amounts */}
            <div className="row" style={{ gap: 4, alignItems: "flex-end", height: 34, margin: "10px 0" }}>
              {r.amounts.map((a, i) => <div key={i} style={{ width: 18, height: `${(a / Math.max(...r.amounts)) * 100}%`, background: i === r.amounts.length - 1 && r.status === "price_changed" ? "var(--red)" : "var(--purple)", border: "2px solid var(--ink)", borderRadius: 4 }} />)}
            </div>
            {r.note && <div className="small" style={{ fontWeight: 600 }}>{r.note}</div>}
            {r.status !== "active" && goa >= 0 && <div className="small" style={{ marginTop: 6 }}>{goalsStuck(state) ? <>Cancel → <b>{inr(r.last * 12)}/year</b> back</> : <>Cancel → Goa <b>{days(daysGainedOnGoal(state, goa, r.last))} sooner</b></>} </div>}
            <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => bury(r.merchant, r.last, r.nextDue)}>{confirm === r.merchant ? "Tap again to bury" : "Bury it"}</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: "#1b1b22", color: "#eee" }}>
        <h2>The Graveyard</h2>
        <p className="small" style={{ opacity: .7 }}>Subscriptions you&apos;ve slain. Each one = money back toward goals.</p>
        {graveyard.length === 0 ? <p style={{ opacity: .7 }}>Empty… for now. Cult.fit is looking nervous</p> : (
          <div className="row wrap" style={{ gap: 16, marginTop: 10 }}>
            {graveyard.map((r) => (
              <div key={r.merchant} className="popin" style={{ width: 150, textAlign: "center", padding: "22px 10px 14px", background: "#55536a", border: "3px solid #000", borderRadius: "70px 70px 10px 10px", boxShadow: "4px 4px 0 #000" }}>
                <div style={{ fontSize: 12, letterSpacing: 2 }}>R.I.P.</div>
                <div style={{ fontWeight: 600, fontFamily: "Bricolage Grotesque", fontSize: 18 }}>{r.merchant}</div>
                <div className="small">{inr(r.yearly)}/yr saved</div>
                <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => update((s) => ({ ...s, cancelled: s.cancelled.filter((x) => x !== r.merchant) }))}>revive</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Other recurring money</h2>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>What</th><th>Amount</th><th>Every</th><th>Next</th></tr></thead>
          <tbody>
            {fixed.map((r) => <tr key={r.merchant}><td><CatIcon c={r.category} />{r.merchant}</td><td><b>{inr(r.last)}</b></td><td>~{r.cadence} days</td><td>{new Date(r.nextDue).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
