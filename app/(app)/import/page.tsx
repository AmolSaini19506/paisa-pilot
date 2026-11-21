"use client";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { TraceButton } from "@/components/Shell";
import { CatIcon } from "@/components/Icons";
import { parseCsvRows, splitSms } from "@/lib/parser";
import { ingest, type IngestResult } from "@/lib/pipeline";
import { SAMPLE_CSV, SAMPLE_SMS } from "@/lib/seed";
import { authHeaders, useStore } from "@/lib/store";
import { inr } from "@/lib/twin";

export default function ImportPage() {
  const { state, update, addTrace, toast } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<IngestResult | null>(null);
  const [traceId, setTraceId] = useState<string>();
  const csvRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const commit = (r: IngestResult, label: string) => {
    update((s) => ({ ...s, txns: [...r.added, ...s.txns].sort((a, b) => b.date.localeCompare(a.date)), memoryDiff: { at: new Date().toISOString(), lines: r.diff } }));
    const id = addTrace(label, r.steps);
    setTraceId(id);
    setRes(r);
    toast(`${r.added.length} transactions in, ${r.skipped.length} junk filtered`, "");
  };

  const runSms = async () => {
    if (!text.trim()) return;
    setBusy("Parsing SMS…");
    const lines = splitSms(text);
    const r = await ingest(state, "sms", null, lines);
    commit(r, `SMS import (${lines.length} messages)`);
    setBusy(null);
  };

  const runCsv = async (csv: string) => {
    setBusy("Reading CSV…");
    const rows = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true }).data;
    const parsed = parseCsvRows(rows);
    const r = await ingest(state, "csv", parsed, []);
    commit(r, `CSV import (${rows.length} rows)`);
    setBusy(null);
  };

  const runPdf = async (f: File) => {
    setBusy("Extracting PDF text…");
    const fd = new FormData(); fd.append("file", f);
    const j = await fetch("/api/pdf", { method: "POST", body: fd, headers: authHeaders() }).then((r) => r.json()).catch(() => ({ lines: [] }));
    if (!j.lines?.length) { toast("Couldn't find transaction lines in that PDF ", ""); setBusy(null); return; }
    setBusy(`AI is reading ${j.lines.length} statement lines…`);
    const r = await ingest(state, "pdf", null, j.lines);
    r.steps.unshift({ agent: "Ingest", action: `PDF text extracted (${j.pages} page${j.pages > 1 ? "s" : ""})`, detail: `${j.lines.length} candidate lines` });
    commit(r, `PDF statement (${f.name})`);
    setBusy(null);
  };

  return (
    <div className="grid stagger" style={{ gap: 22 }}>
      <div>
        <h1>Feed me your mess</h1>
        <p className="muted">Bank SMS, UPI alerts, CSV exports, PDF statements. HDFC, ICICI, SBI, Axis, Kotak — Rs, INR, ₹, lakhs, OTP spam, duplicate alerts. I&apos;ll sort it.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
        <div className="card">
          <div className="row between wrap" style={{ marginBottom: 10 }}>
            <h2>Paste bank SMS</h2>
            <button className="btn sm ghost" onClick={() => setText(SAMPLE_SMS)}>Load 15 messy sample SMS</button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Rs.180.00 debited from HDFC Bank A/c **4821 on 21-NOV-26 to VPA bharatpe.90718@icici ...\n\nOne SMS per line or separated by blank lines."} />
          <div className="row between wrap" style={{ marginTop: 12 }}>
            <span className="small muted">Parsed in your session. Raw text isn&apos;t stored after import.</span>
            <button className="btn" onClick={runSms} disabled={!!busy || !text.trim()}>{busy ?? "Parse it "}</button>
          </div>
        </div>
        <div className="grid" style={{ gap: 18 }}>
          <div className="card" style={{ background: "var(--tint)" }}>
            <h3>Bank CSV</h3>
            <p className="small">HDFC / ICICI / SBI export columns auto-detected.</p>
            <input ref={csvRef} type="file" accept=".csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) runCsv(await f.text()); e.target.value = ""; }} />
            <div className="row wrap">
              <button className="btn sm ghost" disabled={!!busy} onClick={() => csvRef.current?.click()}>Upload CSV</button>
              <button className="btn sm purple" disabled={!!busy} onClick={() => runCsv(SAMPLE_CSV)}>Try sample</button>
            </div>
          </div>
          <div className="card" style={{ background: "var(--tint)" }}>
            <h3>PDF statement</h3>
            <p className="small">Text PDFs. The AI reads the lines and structures them.</p>
            <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) runPdf(f); e.target.value = ""; }} />
            <div className="row wrap">
              <button className="btn sm ghost" disabled={!!busy} onClick={() => pdfRef.current?.click()}>Upload PDF</button>
              <a className="btn sm yellow" href="/sample-statement.pdf" download>Get sample PDF</a>
            </div>
          </div>
        </div>
      </div>

      {res && (
        <div className="card popin">
          <div className="row between wrap">
            <h2>Done  {res.added.length} in · {res.skipped.length} filtered</h2>
            <TraceButton id={traceId} label="See every agent step " />
          </div>
          <div className="row wrap" style={{ margin: "10px 0" }}>
            {res.diff.map((d, i) => <span key={i} className="chip cyan" style={{ whiteSpace: "normal" }}>{d}</span>)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Category</th><th className="hide-m">How</th></tr></thead>
              <tbody>
                {res.added.map((t) => (
                  <tr key={t.id} className="flash">
                    <td className="mono">{t.date.slice(5)}</td>
                    <td><b>{t.merchant}</b>{t.vpa && <div className="mono muted">{t.vpa}</div>}</td>
                    <td style={{ fontWeight: 600, color: t.dir === "credit" ? "var(--green)" : undefined }}>{t.dir === "credit" ? "+" : "-"}{inr(t.amount)}</td>
                    <td><CatIcon c={t.category} />{t.category} {t.review && <span className="chip yellow">review</span>}</td>
                    <td className="hide-m"><span className={`chip ${t.src === "llm" ? "purple" : t.src === "rule" ? "pink" : ""}`}>{t.src === "llm" ? `AI ${Math.round(t.conf * 100)}%` : t.src}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.skipped.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Filtered out ({res.skipped.length})</summary>
              {res.skipped.map((s, i) => <div key={i} className="small" style={{ padding: "6px 0", borderBottom: "1px dashed var(--muted)" }}><b>{s.why}</b> <span className="mono muted">{s.raw.slice(0, 110)}…</span></div>)}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
