import { CATEGORIES } from "../../lib/categories";
import type { TraceStep } from "../../lib/types";

// Cloudflare Workers AI (free tier) via the AI binding in wrangler.toml
const FAST = "@cf/meta/llama-3.1-8b-instruct-fast";
const SMART = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
let AI: any = null;
const J = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), { status: init?.status ?? 200, headers: { "content-type": "application/json" } });
const CATS = CATEGORIES.map((c) => c.name).join(", ");


// ---------- guardrail ----------
const ASKS_SECURITY = /\b(which|what|best|top|suggest|recommend|should i (buy|invest)|tell me)\b.*\b(stock|share|equity|mutual fund|fund|etf|crypto|coin|bitcoin|ipo|small ?cap|mid ?cap|smallcap|midcap|f&o|option)/i;
const NAMES_SECURITY = /\b(parag parikh|axis bluechip|mirae|nippon india|quant (small|active)|sbi small ?cap|hdfc (mid|flexi|top)|icici pru(dential)? \w+ fund|reliance industries|tata motors|infosys|tcs share|zomato share|adani|nifty ?bees|bitcoin|ethereum|dogecoin)\b|\b(buy|sell|accumulate)\s+[A-Z]{3,}\b/i;

const GUARD_RULES = `GUARDRAILS (non-negotiable):
- You are an educator and scenario modeller, NOT a SEBI-registered investment adviser.
- Never name, rank or recommend specific stocks, mutual funds, ETFs, crypto, IPOs or any security, and never say buy/sell/hold for one.
- When asked, say so kindly in one line, then teach the concept (e.g. SIP vs FD vs emergency fund, risk, time horizon, diversification, expense ratio) and model numbers with ASSUMED generic returns, clearly labelled as assumptions.
- Emergency fund and high-interest debt come before risky investing.`;

function fallbackGuard(voice: string) {
  return voice === "roast"
    ? "Bestie, I'm a money coach, not your stock-tip uncle on WhatsApp 😅 I don't name stocks or funds. What I CAN do: your emergency fund is at ~2.1 months, so step one is getting that to 6. After that, here's the maths: ₹5,000/month for 10 years at an assumed 10% a year grows to about ₹10.3 lakh vs ~₹8.2 lakh at an assumed 6% FD-like rate. Higher assumed return = higher risk + bigger swings. Want me to model a few amounts?"
    : "Love that you're thinking about investing! 🌱 I can't recommend specific stocks or funds, but I can help you think it through. First, your emergency fund is ~2.1 months, and 6 months is the safe zone. Then, as an illustration: ₹5,000/month for 10 years at an assumed 10% a year ≈ ₹10.3 lakh, vs ≈ ₹8.2 lakh at an assumed 6%. Higher return assumptions come with more risk. Want me to model different amounts?";
}

// ---------- helpers ----------
async function llm(model: string, system: string, user: string, maxTokens = 1200) {
  if (!AI) throw new Error("AI binding missing");
  const r: any = await AI.run(model, {
    max_tokens: maxTokens,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  const out = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? "");
  if (!out) throw new Error("empty AI response");
  return out;
}
function json<T>(s: string): T {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : s;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return JSON.parse(body.slice(start, end + 1));
}

// ---------- heuristic fallbacks ----------
function heurCategory(text: string): { category: string; conf: number; reason: string } {
  const t = text.toLowerCase();
  if (/chai|tea|coffee|bharatpe|paytmqr|snack|bakery|juice/.test(t)) return { category: "Snacks/Chai", conf: 0.72, reason: "Small UPI to a street-vendor style QR" };
  if (/lenskart|optical|apollo|pharma|clinic/.test(t)) return { category: "Health", conf: 0.8, reason: "Eyewear/pharmacy merchant" };
  if (/pvr|inox|bookmyshow|movie|cinema/.test(t)) return { category: "Dining out", conf: 0.6, reason: "Entertainment outing" };
  if (/decathlon|sport/.test(t)) return { category: "Shopping", conf: 0.85, reason: "Sports retail" };
  if (/split|dinner|okaxis|oksbi|okicici|okhdfc/.test(t)) return { category: "Family transfers", conf: 0.5, reason: "Person-to-person UPI" };
  if (/self|own a\/c/.test(t)) return { category: "Other", conf: 0.6, reason: "Self transfer" };
  return { category: "Other", conf: 0.3, reason: "Not enough signal" };
}

function heurScenario(text: string) {
  const t = text.toLowerCase();
  const pct = (re: RegExp) => { const m = t.match(re); return m ? parseInt(m[1]) : 0; };
  const half = /half|50/.test(t);
  const third = /third/.test(t);
  const sc: any = { foodCut: 0, leakCut: 0, shoppingCut: 0, rentHike: 0, incomeHike: 0, extraSip: 0, cancelSubs: 0 };
  if (/swiggy|zomato|order|food|dining|eat/.test(t)) sc.foodCut = pct(/(\d+)\s*%?\s*(?:less|cut|kam)/) || (third ? 33 : half ? 50 : 30);
  if (/chai|leak|snack/.test(t)) sc.leakCut = half ? 50 : pct(/(\d+)\s*%/) || 50;
  if (/shop|amazon|myntra/.test(t)) sc.shoppingCut = pct(/(\d+)\s*%/) || 30;
  if (/rent/.test(t)) sc.rentHike = pct(/rent[^\d]*(\d+)/) || 10;
  if (/hike|raise|increment|salary/.test(t)) sc.incomeHike = pct(/(?:hike|raise|increment)[^\d]*(\d+)/) || pct(/(\d+)\s*%\s*(?:hike|raise)/) || 10;
  const sip = t.match(/sip[^\d]*(\d[\d,]*)/); if (sip) sc.extraSip = parseInt(sip[1].replace(/,/g, ""));
  if (/cancel|cult|gym/.test(t)) sc.cancelSubs = 1499;
  return sc;
}

// ---------- coach tools ----------
const TOOLS: any[] = [
  { name: "get_twin", description: "Get the user's Money Twin: income, fixed costs, surplus, emergency fund months, goals, health score, memory facts.", input_schema: { type: "object", properties: {} } },
  { name: "query_spend", description: "Get spend by category for a month (YYYY-MM) or the 3-month average when month='avg'. Optionally filter one category.", input_schema: { type: "object", properties: { month: { type: "string" }, category: { type: "string" } }, required: ["month"] } },
  { name: "simulate", description: "Run a what-if. Percent fields are 0-100. Returns goal ETAs vs target dates and days gained/lost.", input_schema: { type: "object", properties: { foodCut: { type: "number" }, leakCut: { type: "number" }, shoppingCut: { type: "number" }, rentHike: { type: "number" }, incomeHike: { type: "number" }, extraSip: { type: "number" }, cancelSubs: { type: "number" } } } },
  { name: "remember_fact", description: "Save a durable fact about the user's money life to memory (e.g. upcoming rent hike, a wedding in Dec, job change). Use when the user shares something future-relevant.", input_schema: { type: "object", properties: { fact: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD when it takes effect, if known" } }, required: ["fact"] } },
];

export async function onRequestPost(context: any) {
  AI = context.env?.AI ?? null;
  const { task, payload } = await context.request.json();
  const trace: TraceStep[] = [];
  const t0 = Date.now();
  const step = (agent: string, action: string, detail?: string) => trace.push({ agent, action, detail, ms: Date.now() - t0 });

  try {
    // ============ CATEGORIZE (batch) ============
    if (task === "categorize") {
      const items: { i: number; merchant: string; vpa?: string; raw: string; amount: number }[] = payload.items;
      step("Categorizer", `${items.length} merchants unknown to rules + memory + seed map`, "escalating to LLM in one batch");
      try {
        const out = await llm(FAST,
          `You categorise Indian bank transactions. Allowed categories: ${CATS}. Small (<₹250) UPI payments to bharatpe/paytmqr/q-number VPAs are usually street food, chai or snacks -> "Snacks/Chai". Person-to-person UPI (ok* handles) with words like split/dinner -> "Dining out". Return ONLY JSON array [{"i":number,"category":string,"conf":0-1,"reason":"<=8 words"}].`,
          JSON.stringify(items));
        const res = json<any[]>(out);
        step("Categorizer", `LLM (${FAST}) labelled ${res.length}`, res.map((r) => `#${r.i}→${r.category} (${Math.round(r.conf * 100)}%)`).join(", "));
        return J({ data: res, trace, llm: true });
      } catch (e: any) {
        const res = items.map((it) => ({ i: it.i, ...heurCategory(`${it.merchant} ${it.vpa ?? ""} ${it.raw}`) }));
        step("Categorizer", "LLM unavailable → heuristic fallback", e.message);
        return J({ data: res, trace, llm: false });
      }
    }

    // ============ PARSE (LLM fallback for SMS regex missed / PDF text) ============
    if (task === "parse") {
      const lines: string[] = payload.lines;
      step("Ingest", `${lines.length} message(s) didn't match any regex template`, "asking LLM to extract structured fields");
      try {
        const out = await llm(FAST,
          `Extract Indian bank/UPI/card transactions from raw text (SMS or statement lines). Ignore OTPs, promos and balance-only messages. Amounts may use Rs, INR, ₹ and Indian grouping (1,00,000). Return ONLY JSON array of {"idx":number (input index),"date":"YYYY-MM-DD","amount":number,"dir":"debit"|"credit","kind":"upi"|"card"|"neft"|"autodebit"|"refund"|"atm"|"other","merchant":string,"vpa":string|null,"ref":string|null}. Today is 2026-11-21.`,
          JSON.stringify(lines.map((l, i) => ({ idx: i, text: l }))), 3000);
        const res = json<any[]>(out);
        step("Ingest", `LLM (${FAST}) extracted ${res.length} transaction(s)`);
        return J({ data: res, trace, llm: true });
      } catch (e: any) {
        step("Ingest", "LLM unavailable → left for manual review", e.message);
        return J({ data: [], trace, llm: false });
      }
    }

    // ============ RULE LEARNER ============
    if (task === "rule") {
      const { txn, category, candidate, examples } = payload;
      step("Rule learner", `User moved "${txn.merchant}" → ${category}`, `candidate: ${candidate.field} ${candidate.type} "${candidate.pattern}" matches ${candidate.matches}`);
      try {
        const out = await llm(FAST,
          `You generalise a user's transaction-category correction into a safe rule. Prefer the narrowest pattern that still captures obviously-similar merchants. Return ONLY JSON {"field":"vpa"|"merchant","type":"prefix"|"contains"|"equals","pattern":string,"why":"one friendly sentence, Gen-Z tone, <=20 words"}.`,
          JSON.stringify({ corrected: { merchant: txn.merchant, vpa: txn.vpa, raw: txn.raw, amount: txn.amount }, newCategory: category, candidate, similarExamples: examples }));
        const r = json<any>(out);
        step("Rule learner", `LLM (${FAST}) proposed ${r.field} ${r.type} "${r.pattern}"`, r.why);
        return J({ data: r, trace, llm: true });
      } catch (e: any) {
        step("Rule learner", "Using deterministic candidate", e.message);
        return J({ data: candidate, trace, llm: false });
      }
    }

    // ============ SCENARIO (natural language -> sliders) ============
    if (task === "scenario") {
      step("Planner", "Parsing what-if sentence", payload.text);
      try {
        const out = await llm(FAST,
          `Convert a user's what-if (English or Hinglish) into JSON {"foodCut":0-100,"leakCut":0-100,"shoppingCut":0-100,"rentHike":0-100,"incomeHike":0-100,"extraSip":rupees per month,"cancelSubs":rupees per month}. foodCut covers Swiggy/Zomato/dining. leakCut is tiny chai/snack UPI spends. Cancelling Cult.fit = 1499. Unmentioned fields = 0. Return ONLY JSON.`,
          payload.text, 300);
        const sc = json<any>(out);
        step("Planner", `LLM (${FAST}) → scenario`, JSON.stringify(sc));
        return J({ data: sc, trace, llm: true });
      } catch (e: any) {
        const sc = heurScenario(payload.text);
        step("Planner", "Keyword parser fallback", JSON.stringify(sc));
        return J({ data: sc, trace, llm: false });
      }
    }

    // ============ COACH (tool use loop) ============
    if (task === "coach") {
      const { messages, ctx, voice } = payload;
      const last = messages[messages.length - 1]?.text ?? "";
      const flagged = ASKS_SECURITY.test(last);
      step("Guardrail", flagged ? "Pre-check: asks for a specific security → education mode" : "Pre-check passed");
      const persona = voice === "roast"
        ? "Voice: playful ROAST mode. Gen-Z, witty, light Hinglish (yaar, bhai, scene, bestie), max 2 emoji. Roast the spending, never the person. Still precise with numbers."
        : "Voice: wholesome HYPE mode. Gen-Z, warm, encouraging, light Hinglish, max 2 emoji. Celebrate wins, frame cuts as power moves.";
      const system = `You are Paisa Pilot, an Indian personal finance coach for young earners. ${persona}
Use tools to ground every number in the user's Money Twin. Express trade-offs as days gained/lost on named goals. Keep replies under 110 words, INR with Indian grouping. If the user shares a future money event, call remember_fact.
${GUARD_RULES}${flagged ? "\nTHIS QUESTION ASKS FOR A SPECIFIC SECURITY: decline naming any, then educate." : ""}`;

      if (!AI) {
        step("Coach", "AI unavailable → offline template answer");
        const text = flagged ? fallbackGuard(voice) : offlineCoach(last, ctx, voice);
        return J({ data: { text, guardrail: flagged, facts: [] }, trace, llm: false });
      }

      const facts: any[] = [];
      let text = "";
      try {
        // Step 1 — planner: decide which tools to call (ReAct-style, JSON)
        const toolList = TOOLS.map((t) => `- ${t.name}: ${t.description} args: ${JSON.stringify(t.input_schema.properties)}`).join("\n");
        const history = messages.slice(-6).map((m: any) => `${m.role}: ${m.text}`).join("\n");
        const planRaw = await llm(FAST,
          `You are the planning step of a finance coach agent. Pick the tools needed to answer the user's LAST message. Tools:\n${toolList}\nRules: always include get_twin. Use simulate for any what-if (percent fields 0-100). Use remember_fact when the user shares a future money event. Return ONLY JSON {"calls":[{"name":string,"args":object}]}.`,
          history, 300);
        let calls: any[] = [];
        try { calls = json<any>(planRaw).calls ?? []; } catch { calls = [{ name: "get_twin", args: {} }]; }
        if (!calls.some((c) => c.name === "get_twin")) calls.unshift({ name: "get_twin", args: {} });
        step("Coach", `Planner (${FAST}) chose ${calls.length} tool call(s)`, calls.map((c) => c.name).join(", "));
        // Step 2 — execute tools against the Money Twin snapshot
        const results: any = {};
        for (const c of calls.slice(0, 5)) {
          const a = c.args ?? {};
          let out: any;
          if (c.name === "get_twin") out = ctx.twin;
          else if (c.name === "query_spend") out = a.month === "avg" || !a.month ? ctx.avg : ctx.months?.[a.month] ?? ctx.avg;
          else if (c.name === "simulate") out = runSim(ctx, a);
          else if (c.name === "remember_fact" && a.fact) { facts.push({ fact: a.fact, date: a.date }); out = { saved: true }; }
          else continue;
          results[c.name] = out;
          step("Coach", `tool: ${c.name}`, JSON.stringify(a).slice(0, 140));
        }
        // Step 3 — answer grounded in tool results
        text = await llm(SMART, system + `\n\nTOOL RESULTS (ground truth, use these numbers):\n${JSON.stringify(results).slice(0, 7000)}`, history, 500);
      } catch (e: any) {
        step("Coach", "AI error → offline template answer", e.message);
        text = flagged ? fallbackGuard(voice) : offlineCoach(last, ctx, voice);
      }
      let guard = flagged;
      if (NAMES_SECURITY.test(text)) {
        step("Guardrail", "Post-check: named a security → replaced with education answer");
        text = fallbackGuard(voice); guard = true;
      } else step("Guardrail", "Post-check passed: no securities named");
      step("Coach", `Answered with ${SMART.split("/").pop()}`);
      return J({ data: { text, guardrail: guard, facts }, trace, llm: true });
    }

    // ============ MONTHLY REVIEW ============
    if (task === "review") {
      const { stats, ctx, voice } = payload;
      step("Reviewer", `Pulling stats for ${stats.month}`, `${stats.count} transactions, ${ctx.recurring?.length ?? 0} recurring`);
      try {
        const out = await llm(SMART,
          `Write a monthly money review for a young Indian earner as Markdown with these sections: "## The vibe" (2 sentences), "## Wins 🏆" (2-3 bullets), "## Leaks 🕳️" (2-3 bullets with ₹ amounts), "## Subscriptions check" (1-2 bullets), "## Goal runway" (one line per goal: on track or late, and by how much), "## Next month's 3 moves" (numbered, each with ₹ impact and days gained on a goal). Tone: ${voice === "roast" ? "playful roast, Gen-Z, light Hinglish" : "warm hype, Gen-Z, light Hinglish"}. Under 260 words. Use only the numbers given. ${GUARD_RULES}`,
          JSON.stringify({ stats, ctx }), 1200);
        step("Reviewer", `Written by ${SMART}`);
        step("Guardrail", NAMES_SECURITY.test(out) ? "Flagged" : "Post-check passed");
        return J({ data: out, trace, llm: true });
      } catch (e: any) {
        step("Reviewer", "LLM unavailable → template review", e.message);
        return J({ data: null, trace, llm: false });
      }
    }

    // ============ FUTURE YOU LETTER ============
    if (task === "letter") {
      const { ctx, mode } = payload;
      step("Storyteller", `Writing a letter from Riya in 2030 (${mode} path)`);
      try {
        const out = await llm(SMART,
          `Write a short letter (110-140 words) from the user's future self in Nov 2030 to their present self. Path: ${mode === "drift" ? "they kept drifting (delivery, chai leak, ghost subscriptions) — bittersweet but kind, specific consequences" : "they stuck to the plan — proud, specific wins"}. Mention their real goals and numbers. Gen-Z, light Hinglish, 1-2 emoji. No investment product names. Sign off "— You, 2030".`,
          JSON.stringify(ctx), 500);
        return J({ data: out, trace, llm: true });
      } catch (e: any) {
        step("Storyteller", "LLM unavailable → template letter", e.message);
        return J({ data: null, trace, llm: false });
      }
    }

    return J({ error: "unknown task" }, { status: 400 });
  } catch (e: any) {
    step("System", "Error", e.message);
    return J({ error: e.message, trace }, { status: 200 });
  }
}

// ---------- server-side sim mirror (ctx carries precomputed numbers) ----------
function runSim(ctx: any, sc: any) {
  const avg = ctx.avg || {};
  const delta =
    ((avg["Food delivery"] ?? 0) + (avg["Dining out"] ?? 0)) * ((sc.foodCut ?? 0) / 100) +
    (ctx.leak ?? 0) * ((sc.leakCut ?? 0) / 100) +
    (avg["Shopping"] ?? 0) * ((sc.shoppingCut ?? 0) / 100) +
    ctx.twin.income * ((sc.incomeHike ?? 0) / 100) + (sc.cancelSubs ?? 0) - (sc.extraSip ?? 0) -
    (avg["Rent"] ?? 0) * ((sc.rentHike ?? 0) / 100);
  const surplus = ctx.twin.surplus + delta;
  return {
    newMonthlySurplus: Math.round(surplus), changePerMonth: Math.round(delta),
    goals: (ctx.goals || []).map((g: any) => {
      const need = g.target - g.saved;
      const base = need / Math.max(ctx.twin.surplus * g.weight, 1);
      const now = need / Math.max(surplus * g.weight, 1);
      return { goal: g.name, targetDate: g.date, monthsToGoal: +now.toFixed(1), daysGained: Math.round((base - now) * 30.44) };
    }),
  };
}

function offlineCoach(q: string, ctx: any, voice: string) {
  const r = voice === "roast";
  const tw = ctx.twin;
  if (/goa|trip|afford/i.test(q)) {
    const g = ctx.goals.find((x: any) => /goa/i.test(x.name));
    return `${r ? "Scene check bhai 🏖️" : "Ooh Goa! 🏖️"} You need ${"₹" + (g.target - g.saved).toLocaleString("en-IN")} more by 15 Mar. Your surplus is ~₹${Math.round(tw.surplus).toLocaleString("en-IN")}/month and 30% of it goes to Goa, so it's doable${r ? " IF Swiggy stops being your love language" : ""}. Cutting delivery 30% gets you there ~2 weeks earlier.`;
  }
  return `${r ? "Okay bestie, real talk:" : "Here's where you stand 💪"} income ₹${tw.income.toLocaleString("en-IN")}, fixed costs ~₹${Math.round(tw.fixed).toLocaleString("en-IN")}, surplus ~₹${Math.round(tw.surplus).toLocaleString("en-IN")}/month, emergency fund ${tw.efMonths.toFixed(1)} months. Biggest lever right now: food delivery + the chai leak. Ask me "what if I cut Swiggy by a third?"`;
}
