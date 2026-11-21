# Paisa Pilot 🪙

India-first agentic money coach built for the Product Space Agentic AI Hackathon (problem #4: Personal Finance Coach with a Living Money Model).

- Paste raw Indian bank / UPI SMS, upload a bank CSV or a PDF statement
- Regex fast path + AI fallback parser, tiered categoriser (learned rules → merchant memory → seed map → AI)
- Correction loop that learns rules and re-labels history
- Subscription detection with price-change and "ghost" alerts, plus a graveyard
- Money Twin profile, Money Health score, Chai Leak detector, nudges in "days gained/lost on a goal"
- Goal planner with live what-if sliders and natural-language scenarios, Future You letters
- Coach chat (roast / hype voice) with a planner → tools → answer loop and an investment guardrail
- Monthly review + shareable Paisa Wrapped card
- Every agent step is logged and viewable ("How I got this")

## Stack
Next.js (static export) on Cloudflare Pages, Pages Functions in `functions/api`, Cloudflare Workers AI (Llama 3.x) via the `AI` binding in `wrangler.toml`. Built-in fallbacks keep everything working if the AI is unavailable.

## Deploy
Cloudflare → Workers & Pages → Create → Pages → Connect to Git → this repo. Framework preset: None. Build command: `npm run build`. Output directory: `out`.

Judge login: `judge@paisapilot.app` / `chai2026` (demo data, stored in the browser).
