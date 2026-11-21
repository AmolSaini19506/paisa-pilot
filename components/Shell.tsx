"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { LayoutDashboard, Inbox, ReceiptText, Repeat, Target, MessageCircle, CalendarRange, Search, RotateCcw, LogOut, Flame, Heart, Lock, type LucideIcon } from "lucide-react";

const NAV: { href: string; label: string; short: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Money Twin", short: "Twin", icon: LayoutDashboard },
  { href: "/import", label: "Import", short: "Import", icon: Inbox },
  { href: "/txns", label: "Transactions", short: "Txns", icon: ReceiptText },
  { href: "/subs", label: "Subscriptions", short: "Subs", icon: Repeat },
  { href: "/goals", label: "Goals & What-if", short: "Goals", icon: Target },
  { href: "/coach", label: "Coach", short: "Coach", icon: MessageCircle },
  { href: "/review", label: "Monthly Review", short: "Review", icon: CalendarRange },
];

const AGENT_COLORS: Record<string, string> = { Guardrail: "var(--red)" };

export function AgentTag({ name }: { name: string }) {
  return <span className="agent-tag" style={{ background: AGENT_COLORS[name] ?? "var(--tint)", color: AGENT_COLORS[name] ? "#fff" : "var(--ink)" }}>{name}</span>;
}

export function TraceButton({ id, label = "How I got this" }: { id?: string; label?: string }) {
  const { openTrace } = useStore();
  if (!id) return null;
  return <button className="trace-btn" onClick={() => openTrace(id)}><Search size={12} style={{ verticalAlign: "-2px" }} />{label}</button>;
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
          <h2>Agent trace</h2>
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
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}><n.icon size={18} strokeWidth={1.75} />{n.label}</Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card" style={{ padding: 12, boxShadow: "none" }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Coach voice</div>
            <div className="row">
              <button className={`btn sm ${state.voice === "roast" ? "purple" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "roast" }))}><Flame size={14} />Roast</button>
              <button className={`btn sm ${state.voice === "hype" ? "purple" : "ghost"}`} onClick={() => update((s) => ({ ...s, voice: "hype" }))}><Heart size={14} />Hype</button>
            </div>
          </div>
          <button className="btn sm ghost" onClick={() => openTrace("all")}><Search size={14} />Agent runs ({state.traces.length})</button>
          <div className="small muted"><Lock size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Raw SMS parsed in your session; only structured rows are kept.</div>
          <button className="btn sm ghost" onClick={() => { reset(); toast("Demo data reset to fresh Riya", "↺"); router.push("/home"); }}><RotateCcw size={14} />Reset demo data</button>
          <button className="btn sm ghost" onClick={() => { logout(); router.replace("/"); }}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <nav className="mobile-nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}><n.icon size={19} strokeWidth={1.75} />{n.short}</Link>
        ))}
      </nav>
      <TraceDrawer />
      <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </div>
  );
}
