"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/home", label: "Money Twin", short: "Twin", emoji: "🪞" },
  { href: "/import", label: "Import", short: "Import", emoji: "📥" },
  { href: "/txns", label: "Transactions", short: "Txns", emoji: "🧾" },
  { href: "/subs", label: "Subscriptions", short: "Subs", emoji: "🪦" },
  { href: "/goals", label: "Goals & What-if", short: "Goals", emoji: "🎯" },
  { href: "/coach", label: "Coach", short: "Coach", emoji: "🗣️" },
  { href: "/review", label: "Monthly Review", short: "Review", emoji: "📼" },
];

const AGENT_COLORS: Record<string, string> = {
  Ingest: "#3de0ff", Categorizer: "#c6ff3d", "Rule learner": "#ff4fd8", Planner: "#ffe14d", Coach: "#ff8a3d",
  Guardrail: "#ff4d5e", Reviewer: "#7b5cff", "Twin builder": "#22c55e", "Subscription watcher": "#ffb3e6", Storyteller: "#b983ff", System: "#cccccc", Nudge: "#ffd36e",
};

export function AgentTag({ name }: { name: string }) {
  return <span className="agent-tag" style={{ background: AGENT_COLORS[name] ?? "#ddd" }}>{name}</span>;
}

export function TraceButton({ id, label = "How I got this 🔍" }: { id?: string; label?: string }) {
  const { openTrace } = useStore();
  if (!id) return null;
  return <button className="trace-btn" onClick={() => openTrace(id)}>{label}</button>;
}

function TraceDrawer() {
  const { state, traceOpen, openTrace } = useStore();
  if (!traceOpen) return null;
  const list = traceOpen === "all" ? state.traces : state.traces.filter((t) => t.id === traceOpen);
  return (
    <>
      <div className="drawer-bg" onClick={() => openTrace(null)} />
      <div className="drawer">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2>Agent trace 🔍</h2>
          <button className="btn sm ghost" onClick={() => openTrace(null)}>close</button>
        </div>
        <p className="muted small">Every agent run, every tool call, every memory write. No black box.</p>
        {list.length === 0 && <p>No agent runs yet. Import something or ask the coach!</p>}
        {list.map((t) => (
          <div key={t.id} style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 8 }}>{t.title}</h3>
            <div className="muted small" style={{ marginBottom: 8 }}>{new Date(t.at).toLocaleTimeString("en-IN")}</div>
            {t.steps.map((s, i) => (
              <div className="step popin" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="row between"><AgentTag name={s.agent} />{s.ms !== undefined && <span className="mono muted">{s.ms}ms</span>}</div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>{s.action}</div>
                {s.detail && <div className="mono muted" style={{ marginTop: 4, wordBreak: "break-word" }}>{s.detail}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { authed, ready, logout, toasts, state, update, openTrace, reset, toast } = useStore();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (ready && !authed) router.replace("/"); }, [ready, authed, router]);
  if (!ready || !authed) return <div style={{ padding: 40 }} className="display">loading the vibes…</div>;
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo"><span className="mark">₹</span>Paisa Pilot</div>
        <nav className="nav" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}><span className="wiggle">{n.emoji}</span>{n.label}</Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card" style={{ padding: 12, boxShadow: "3px 3px 0 var(--ink)" }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Coach voice</div>
            <div className="row">
              <button className={`btn sm ${state.voice === "roast" ? "pink" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "roast" }))}>🔥 Roast</button>
              <button className={`btn sm ${state.voice === "hype" ? "" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "hype" }))}>💖 Hype</button>
            </div>
          </div>
          <button className="btn sm ghost" onClick={() => openTrace("all")}>🔍 All agent runs ({state.traces.length})</button>
          <div className="small muted">🔒 Raw SMS parsed in your session; only structured rows are kept.</div>
          <button className="btn sm ghost" onClick={() => { reset(); toast("Demo data reset to fresh Riya ✨", "↺"); router.push("/home"); }}>↺ Reset demo data</button>
          <button className="btn sm ghost" onClick={() => { logout(); router.replace("/"); }}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <nav className="mobile-nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}><span style={{ fontSize: 18 }}>{n.emoji}</span>{n.short}</Link>
        ))}
      </nav>
      <TraceDrawer />
      <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast">{t.emoji} {t.msg}</div>)}</div>
    </div>
  );
}
