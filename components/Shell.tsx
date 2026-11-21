"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { useStore } from "@/lib/store";
import { computeTwin, paceCheck } from "@/lib/twin";
import { setAccentBase } from "@/lib/accent";
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
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => { if (traceOpen) setLast(traceOpen); }, [traceOpen]);
  const which = traceOpen ?? last;
  const list = which === "all" ? state.traces : state.traces.filter((t) => t.id === which);
  return (
    <Sheet open={!!traceOpen} onClose={() => openTrace(null)} title="Agent trace">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2>Agent trace</h2>
        <button className="btn sm ghost" onClick={() => openTrace(null)}>Done</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Every agent run, tool call and memory write. No black box.</p>
      {list.length === 0 && <p className="muted">No agent runs yet. Import some SMS or ask the coach.</p>}
      {list.map((t) => (
        <div key={t.id} style={{ marginBottom: 20 }}>
          <div className="row between" style={{ marginBottom: 8 }}><h3>{t.title}</h3><span className="muted small">{new Date(t.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></div>
          {t.steps.map((s, i) => (
            <div className="step popin" key={i} style={{ animationDelay: `${120 + i * 40}ms` }}>
              <div className="row between"><AgentTag name={s.agent} />{s.ms !== undefined && <span className="mono muted">{s.ms}ms</span>}</div>
              <div style={{ fontWeight: 500, marginTop: 6 }}>{s.action}</div>
              {s.detail && <div className="mono muted" style={{ marginTop: 4, wordBreak: "break-word" }}>{s.detail}</div>}
            </div>
          ))}
        </div>
      ))}
    </Sheet>
  );
}

const buzz = () => { try { navigator.vibrate?.(8); } catch {} };

function Segmented({ value, onChange }: { value: "roast" | "hype"; onChange: (v: "roast" | "hype") => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Coach voice" data-v={value}>
      <span className="seg-thumb" aria-hidden />
      <button role="radio" aria-checked={value === "roast"} onPointerDown={buzz} onClick={() => onChange("roast")}><Flame size={14} />Roast</button>
      <button role="radio" aria-checked={value === "hype"} onPointerDown={buzz} onClick={() => onChange("hype")}><Heart size={14} />Hype</button>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { authed, ready, logout, toasts, state, update, openTrace, reset, toast } = useStore();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (ready && !authed) router.replace("/"); }, [ready, authed, router]);
  // Money left this month vs. the person's usual month: project this month's flexible spending from its pace.
  const tw = computeTwin(state);
  const pace = paceCheck(state);
  const drift = pace.reduce((a, p) => a + (p.spent / (p.expected / p.avg || 1) - p.avg), 0);
  const ratio = tw.surplus > 0 ? (tw.surplus - drift) / tw.surplus : 0.4;
  useEffect(() => { setAccentBase(ratio); }, [ratio]);
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
            <Segmented value={state.voice} onChange={(v) => update((s) => ({ ...s, voice: v }))} />
          </div>
          <button className="btn sm ghost" onClick={() => openTrace("all")}><Search size={14} />Agent runs ({state.traces.length})</button>
          <div className="small muted"><Lock size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Raw SMS parsed in your session; only structured rows are kept.</div>
          <button className="btn sm ghost" onClick={() => { reset(); toast("Demo data reset to fresh Riya", "↺"); router.push("/home"); }}><RotateCcw size={14} />Reset demo data</button>
          <button className="btn sm ghost" onClick={() => { logout(); router.replace("/"); }}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <nav className="mobile-nav" style={{ ["--i" as any]: Math.max(0, NAV.findIndex((n) => n.href === path)), ["--n" as any]: NAV.length }}>
        <span className="nav-pill" aria-hidden />
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}><n.icon size={19} strokeWidth={1.75} />{n.short}</Link>
        ))}
      </nav>
      <TraceDrawer />
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </div>
  );
}
