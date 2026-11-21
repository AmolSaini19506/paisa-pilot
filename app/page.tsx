"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JUDGE_EMAIL, JUDGE_PW, useStore } from "@/lib/store";

export default function Login() {
  const { login, authed, ready } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (ready && authed) router.replace("/home"); }, [ready, authed, router]);

  const go = (e?: React.FormEvent, em = email, p = pw) => {
    e?.preventDefault();
    if (login(em, p)) router.replace("/home");
    else setErr("Wrong email or password. Use the judge login below");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="grid g2" style={{ maxWidth: 980, width: "100%", alignItems: "center" }}>
        <div>
          <span className="sticker">India-first AI money coach</span>
          <h1 style={{ fontSize: "clamp(38px,6vw,64px)", lineHeight: 1, margin: "18px 0" }}>
            Your money,<br />but make it <span style={{ color: "var(--purple)" }}>make sense</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5 }} className="muted">
            Paste your bank SMS. Paisa Pilot builds a living <b>Money Twin</b>, catches your <b>chai leak</b>, flags ghost subscriptions and tells you exactly how many days your Goa trip just moved.</p>
          <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
            <span className="chip">UPI SMS parser</span><span className="chip">Learns from your fixes</span><span className="chip">What-if planner</span><span className="chip">Roast or hype mode</span>
          </div>
        </div>
        <form className="card popin" onSubmit={go} style={{ padding: 26, boxShadow: "var(--shadow-lg)" }}>
          <div className="row" style={{ marginBottom: 18 }}>
            <span className="logo" style={{ margin: 0 }}><span className="mark">₹</span>Paisa Pilot</span>
          </div>
          <label className="small" style={{ fontWeight: 600 }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" style={{ margin: "6px 0 12px" }} />
          <label className="small" style={{ fontWeight: 600 }}>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••" style={{ margin: "6px 0 16px" }} />
          {err && <div className="small" style={{ color: "var(--red)", fontWeight: 600, marginBottom: 10 }}>{err}</div>}
          <button className="btn" style={{ width: "100%", justifyContent: "center" }}>Log in</button>
          <div className="card" style={{ marginTop: 18, background: "var(--tint)", boxShadow: "none", padding: 14 }}>
            <div style={{ fontWeight: 600 }}>Judge login</div>
            <div className="mono" style={{ margin: "6px 0" }}>{JUDGE_EMAIL} / {JUDGE_PW}</div>
            <button type="button" className="btn sm purple" onClick={() => { setEmail(JUDGE_EMAIL); setPw(JUDGE_PW); go(undefined, JUDGE_EMAIL, JUDGE_PW); }}>One-tap judge login</button>
            <div className="small" style={{ marginTop: 6 }}>Logs in as Riya, 27, Bengaluru, with 3½ months of real-looking data.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
