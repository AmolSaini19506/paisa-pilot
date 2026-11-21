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
Next.js (static export) served by a Cloudflare Worker with static assets (`worker.ts`), API handlers in `functions/api`, Cloudflare Workers AI (Llama 3.x) via the `AI` binding in `wrangler.toml`. Built-in fallbacks keep everything working if the AI is unavailable.

## Deploy
Cloudflare Workers Builds connected to this repo. Build command `npm run build`, deploy command `npx wrangler deploy`.

Judge login: `judge@paisapilot.app` / `chai2026` (demo data, stored in the browser).

## Login and API auth

The password is checked by the Worker (`POST /api/login`), which returns a signed session token. `/api/ai` and `/api/pdf` reject requests without a valid token.

- **Production:** set a Worker secret named `AUTH_SECRET` (any long random string) in Cloudflare → Workers → paisa-pilot → Settings → Variables and secrets. Without it, login is refused. `JUDGE_EMAIL` and `JUDGE_PASSWORD` can override the demo credentials.
- **Preview builds:** add the same secret under the **Previews Base** tab too. A preview only sees secrets that existed when it was built, so push a new commit after adding it.
- **Local:** `next dev` has no Worker, so login won't work there. Build and run the Worker instead: `npm run build && npx wrangler dev --var DEV_AUTH:1`.
