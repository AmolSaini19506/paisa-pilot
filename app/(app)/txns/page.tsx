"use client";
import { useMemo, useState } from "react";
import { TraceButton } from "@/components/Shell";
import { CATEGORIES } from "@/lib/categories";
import { CatIcon } from "@/components/Icons";
import { accuracy, proposeRule, ruleMatches } from "@/lib/categorize";
import { ai, useStore } from "@/lib/store";
import type { Rule, Txn } from "@/lib/types";
import { inr, vibe } from "@/lib/twin";

interface Proposal { txn: Txn; category: string; rule: Omit<Rule, "id" | "createdAt" | "hits">; matches: number; traceId: string; llm: boolean }

export default function Txns() {
  const { state, update, addTrace, toast } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [prop, setProp] = useState<Proposal | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(60);
  const acc = accuracy(state.txns);
  const reviewCount = state.txns.filter((t) => t.review || (t.category === "Other" && t.dir === "debit")).length;

  const list = useMemo(() => {
    let l = state.txns;
    if (filter === "review") l = l.filter((t) => t.review || (t.category === "Other" && t.dir === "debit"));
    else if (filter !== "all") l = l.filter((t) => t.category === filter);
    if (q) l = l.filter((t) => `${t.merchant} ${t.vpa ?? ""} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
    return l;
  }, [state.txns, filter, q]);

  const change = async (t: Txn, category: string) => {
    if (category === t.category) return;
    update((s) => ({ ...s, txns: s.txns.map((x) => (x.id === t.id ? { ...x, category, src: "user", conf: 1, review: false } : x)) }));
    setThinking(t.id);
    const cand = proposeRule(t, category, state.txns);
    const examples = state.txns.filter((x) => x.id !== t.id && ruleMatches({ ...cand, id: "", createdAt: "", hits: 0 }, x)).slice(0, 6).map((x) => ({ merchant: x.merchant, vpa: x.vpa, amount: x.amount, category: x.category }));
    const r = await ai<any>("rule", { txn: t, category, candidate: cand, examples });
    const rule = { field: r.data?.field ?? cand.field, type: r.data?.type ?? cand.type, pattern: (r.data?.pattern ?? cand.pattern).toLowerCase(), category, why: r.data?.why ?? cand.why };
    const matches = state.txns.filter((x) => x.id !== t.id && x.dir === "debit" && ruleMatches({ ...rule, id: "", createdAt: "", hits: 0 }, x) && x.category !== category).length;
    const traceId = addTrace(`Correction: ${t.merchant} → ${category}`, [
      { agent: "Rule learner", action: "Captured user correction", detail: `${t.merchant}${t.vpa ? ` (${t.vpa})` : ""}: ${t.category} → ${category}` },
      ...r.trace,
      { agent: "Rule learner", action: `Dry run: rule would re-label ${matches} past transaction(s)` },
    ]);
    setThinking(null);
    if (matches > 0) setProp({ txn: t, category, rule, matches, traceId, llm: r.llm });
    else toast(`Saved. I'll remember ${t.merchant} = ${category}`, "");
  };

  const accept = () => {
    if (!prop) return;
    const id = "r" + Date.now();
    const rule: Rule = { ...prop.rule, id, createdAt: new Date().toISOString(), hits: 0 } as Rule;
    const changed = new Set<string>(state.txns.filter((x) => x.dir === "debit" && x.category !== rule.category && ruleMatches(rule, x)).map((x) => x.id));
    update((s) => {
      const before = accuracy(s.txns);
      const txns = s.txns.map((x) => {
        if (changed.has(x.id)) return { ...x, category: rule.category, src: "rule" as const, conf: 0.99, review: false };
        return x;
      });
      rule.hits = changed.size;
      return {
        ...s, txns, rules: [rule, ...s.rules], accuracy: { before, after: accuracy(txns) },
        memoryDiff: { at: new Date().toISOString(), lines: [`Learned rule: ${rule.field} ${rule.type} "${rule.pattern}" → ${rule.category}`, `Re-labelled ${changed.size} past transactions`, `Future imports hit this rule before any LLM call`] },
      };
    });
    setFlash(changed);
    setTimeout(() => setFlash(new Set()), 1800);
    toast(`Rule learned! ${prop.matches} past transactions updated`, "");
    setProp(null);
  };

  return (
    <div className="grid stagger" style={{ gap: 20 }}>
      <div className="row between wrap">
        <div>
          <h1>Transactions</h1>
          <p className="muted">Wrong category? Fix it once. I&apos;ll learn a rule and fix the rest.</p>
        </div>
        <div className="row wrap">
          <div className="card" style={{ padding: "10px 14px", background: "var(--lime-wash)", color: "var(--ink)" }}>
            <div className="small" style={{ fontWeight: 600 }}>Auto-categorised</div>
            <div className="big" style={{ fontSize: 26 }}>
              {state.accuracy.after && state.accuracy.before !== state.accuracy.after ? <><span style={{ opacity: .5, fontSize: 18 }}>{state.accuracy.before}% →</span> </> : null}{acc}%
            </div>
          </div>
          <div className="card" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="small" style={{ fontWeight: 600 }}>Rules learned</div>
            <div className="big" style={{ fontSize: 26 }}>{state.rules.length}</div>
          </div>
        </div>
      </div>

      {prop && (
        <div className="card popin" style={{ background: "var(--purple)", color: "var(--accent-ink)", boxShadow: "var(--shadow-lg)" }}>
          <div className="row between wrap">
            <h2>Wanna make it a rule?</h2>
            <TraceButton id={prop.traceId} />
          </div>
          <p style={{ fontSize: 17 }}>
            All <b>{prop.rule.field === "vpa" ? "UPI IDs" : "merchants"}</b>{" "}{prop.rule.type === "prefix" ? "starting with" : prop.rule.type === "equals" ? "equal to" : "containing"} <code style={{ background: "#0b0b0b", color: "var(--lime)", padding: "2px 6px", borderRadius: 6 }}>{prop.rule.pattern}</code> → <b><CatIcon c={prop.category} />{prop.category}</b>
          </p>
          <p style={{ opacity: 0.9 }}>{prop.rule.why} {prop.llm ? "· proposed by the AI agent" : ""}</p>
          <div className="row wrap">
            <button className="btn" onClick={accept}>Yes, fix {prop.matches} past ones</button>
            <button className="btn ghost" onClick={() => setProp(null)}>Just this one</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
          <button className={`btn sm ${filter === "all" ? "" : "ghost"}`} onClick={() => setFilter("all")}>All ({state.txns.length})</button>
          <button className={`btn sm ${filter === "review" ? "yellow" : "ghost"}`} onClick={() => setFilter("review")}>To review ({reviewCount})</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto" }}>
            <option value="all">Any category</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search merchant / UPI ID" style={{ maxWidth: 240 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Category</th><th className="hide-m">Vibe</th></tr></thead>
            <tbody>
              {!list.length && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px 12px" }}>
                  <div style={{ fontWeight: 600 }}>No transactions found</div>
                  <div className="small muted" style={{ marginTop: 4 }}>{state.txns.length ? "Try a different search or category." : "Import your bank SMS or a statement to get started."}</div>
                  {(q || filter !== "all") && <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => { setQ(""); setFilter("all"); }}>Clear filters</button>}
                </td></tr>
              )}
              {list.slice(0, limit).map((t) => (
                <tr key={t.id} className={flash.has(t.id) ? "flash" : ""}>
                  <td className="mono">{t.date.slice(5)}</td>
                  <td>
                    <b>{t.merchant}</b>
                    <div className="mono muted">{t.vpa ?? t.kind.toUpperCase()}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: t.dir === "credit" ? "var(--green)" : undefined }}>{t.dir === "credit" ? "+" : "-"}{inr(t.amount)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <select value={t.category} onChange={(e) => change(t, e.target.value)} style={{ padding: "5px 8px", fontSize: 13, width: "auto", background: t.review || t.category === "Other" ? "var(--purple)" : undefined, color: t.review || t.category === "Other" ? "#111" : undefined }}>
                        {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                      {thinking === t.id && <span className="small">…</span>}
                      {t.src === "rule" && <span className="chip pink" title="categorised by a learned rule">rule</span>}
                      {t.src === "llm" && <span className="chip purple">AI</span>}
                    </div>
                  </td>
                  <td className="hide-m small">{vibe(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length >limit && <div style={{ textAlign: "center", marginTop: 12 }}><button className="btn sm ghost" onClick={() => setLimit(limit + 100)}>Show more ({list.length - limit})</button></div>}
      </div>
    </div>
  );
}
