"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Share2, RotateCcw } from "lucide-react";
import type { AppState } from "@/lib/types";
import { chaiLeakFor, healthScore, inr, monthLabel, monthStats } from "@/lib/twin";
import { Num } from "@/components/Motion";

const FIXED = ["Rent", "EMI", "SIP/Investments", "Family transfers", "Bills & utilities", "Salary", "Refund"];
const DUR = 5200;

function persona(top: string | undefined, savedPct: number, leakN: number) {
  if (savedPct >= 0.4) return { e: "🧘", name: "The Quiet Compounder", line: "You kept a big chunk and didn't make a fuss about it." };
  if (top === "Food delivery") return { e: "🛵", name: "The Swiggy Loyalist", line: "The delivery guy knows your gate code by now." };
  if (top === "Shopping") return { e: "🛍️", name: "The Cart Collector", line: "Add to cart is basically cardio for you." };
  if (top === "Dining out") return { e: "🍝", name: "The Weekend Foodie", line: "Your calendar is just a list of restaurants." };
  if (leakN > 30) return { e: "☕", name: "The Chai Philosopher", line: "Big thoughts, small UPIs, many of them." };
  return { e: "🧭", name: "The Balanced Pilot", line: "Steady hands on the money wheel." };
}

export default function Wrapped({ state, month, onClose }: { state: AppState; month: string; onClose: () => void }) {
  const s = monthStats(state, month);
  const leak = chaiLeakFor(state, month);
  const hs = healthScore(state);
  const data = useMemo(() => {
    const ms = state.txns.filter((t) => t.date.startsWith(month) && t.dir === "debit");
    const flex = ms.filter((t) => !FIXED.includes(t.category));
    const byDay: Record<string, number> = {};
    for (const t of flex) byDay[t.date] = (byDay[t.date] ?? 0) + t.amount;
    const bigDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const top = s.top.find(([k]) => !FIXED.includes(k));
    const usual = top ? s.avg[top[0]] ?? top[1] : 0;
    const vsUsual = top && usual ? Math.round(((top[1] - usual) / usual) * 100) : 0;
    const savedPct = s.inc ? s.saved / s.inc : 0;
    return { bigDay, top, vsUsual, savedPct, p: persona(top?.[0], savedPct, leak.count) };
  }, [state, month]); // eslint-disable-line

  const slides = [
    { bg: "accent", body: (
      <>
        <div className="w-kicker">Paisa Wrapped</div>
        <div className="w-huge">Your {monthLabel(month).split(" ")[0]},<br />wrapped.</div>
        <div className="w-sub">{s.count} transactions. One story. Tap to begin.</div>
      </>) },
    { bg: "dark", body: (
      <>
        <div className="w-kicker">This month you spent</div>
        <div className="w-num"><Num value={s.out} format={inr} /></div>
        <div className="w-sub">and kept <b className="w-acc">{inr(Math.max(0, s.saved))}</b>, that&apos;s {Math.round(data.savedPct * 100)}% of what came in.</div>
      </>) },
    { bg: "light", body: (
      <>
        <div className="w-kicker">Your main character was</div>
        <div className="w-huge">{data.top?.[0] ?? "Nothing"}</div>
        <div className="w-num sm"><Num value={Math.round(data.top?.[1] ?? 0)} format={inr} /></div>
        <div className="w-sub">{data.vsUsual > 0 ? `${data.vsUsual}% more than your usual month.` : data.vsUsual < 0 ? `${-data.vsUsual}% less than your usual month. Growth.` : "Right on your usual."}</div>
      </>) },
    { bg: "dark", body: (
      <>
        <div className="w-kicker">The Chai Leak</div>
        <div className="w-num"><Num value={leak.count} format={(n) => String(n)} /> <span className="w-unit">tiny UPIs</span></div>
        <div className="w-sub">That&apos;s <b className="w-acc">{inr(leak.monthly)}</b> under ₹250 each. Roughly <b className="w-acc">{Math.round(leak.monthly / 20)}</b> cutting chais.</div>
      </>) },
    { bg: "accent", body: (
      <>
        <div className="w-kicker">Your most-visited merchant</div>
        <div className="w-huge">{s.topMerchant?.[0] ?? "—"}</div>
        <div className="w-sub">{s.topMerchant?.[1] ?? 0} visits. They should probably know your name.</div>
      </>) },
    { bg: "light", body: (
      <>
        <div className="w-kicker">Your biggest spend day</div>
        <div className="w-huge">{data.bigDay ? new Date(data.bigDay[0]).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) : "—"}</div>
        <div className="w-num sm"><Num value={Math.round(data.bigDay?.[1] ?? 0)} format={inr} /></div>
        <div className="w-sub">Biggest single flex: {s.biggest?.merchant} at {s.biggest && inr(s.biggest.amount)}.</div>
      </>) },
    { bg: "dark", body: (
      <>
        <div className="w-kicker">Your money personality</div>
        <div className="w-emoji">{data.p.e}</div>
        <div className="w-huge">{data.p.name}</div>
        <div className="w-sub">{data.p.line}</div>
      </>) },
    { bg: "accent", final: true, body: null },
  ];
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const next = useCallback(() => setI((x) => Math.min(n - 1, x + 1)), [n]);
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    if (paused || i >= n - 1) return;
    timer.current = window.setTimeout(next, DUR);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, paused, next, n]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight" || e.key === " ") next(); if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [next, prev, onClose]);

  const tap = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.clientX - r.left < r.width * 0.33 ? prev : next)();
  };
  const shareText = `My ${monthLabel(month)} on Paisa Pilot: spent ${inr(s.out)}, kept ${inr(Math.max(0, s.saved))}. Main character: ${data.top?.[0]}. Chai leak: ${leak.count} tiny UPIs. Personality: ${data.p.name} ${data.p.e}`;
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: "My Paisa Wrapped", text: shareText }); return; } } catch {}
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };
  const sl = slides[i];

  return (
    <div className="w-overlay" role="dialog" aria-modal="true" aria-label="Paisa Wrapped">
      <div className={`w-stage w-${sl.bg}`} onClick={tap} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <div className="w-bars">
          {slides.map((_, k) => (
            <span key={k}><i className={k < i ? "done" : k === i ? (i === n - 1 ? "done" : "run") : ""} style={k === i ? { animationDuration: `${DUR}ms`, animationPlayState: paused ? "paused" : "running" } : undefined} /></span>
          ))}
        </div>
        <div className="w-top">
          <span className="w-brand">paisa<b>pilot</b> · {monthLabel(month)}</span>
          <button className="w-x" onClick={onClose} aria-label="Close Wrapped"><X size={20} /></button>
        </div>
        <div className="w-body" key={i}>
          {sl.final ? (
            <div className="w-card">
              <div className="w-card-head"><span>Paisa Wrapped</span><span>{monthLabel(month)}</span></div>
              <div className="w-card-emoji">{data.p.e}</div>
              <div className="w-card-name">{data.p.name}</div>
              <div className="w-card-grid">
                <div><span>Spent</span><b>{inr(s.out)}</b></div>
                <div><span>Kept</span><b>{inr(Math.max(0, s.saved))}</b></div>
                <div><span>Main character</span><b>{data.top?.[0]}</b></div>
                <div><span>Chai leak</span><b>{leak.count} UPIs</b></div>
                <div><span>Top merchant</span><b>{s.topMerchant?.[0]}</b></div>
                <div><span>Money health</span><b>{hs.score}/100</b></div>
              </div>
              <div className="w-card-foot">made with Paisa Pilot</div>
            </div>
          ) : sl.body}
        </div>
        {sl.final && (
          <div className="w-actions">
            <button className="w-btn" onClick={share}><Share2 size={18} />{copied ? "Copied" : "Share"}</button>
            <button className="w-btn ghost" onClick={() => setI(0)}><RotateCcw size={18} />Replay</button>
          </div>
        )}
        {!sl.final && <div className="w-hint">Tap to continue · hold to pause</div>}
      </div>
    </div>
  );
}
