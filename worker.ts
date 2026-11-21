// Cloudflare Worker entry: API routes + static Next.js export served from ASSETS
import { onRequestPost as aiHandler } from "./functions/api/ai";
import { onRequestPost as pdfHandler } from "./functions/api/pdf";
import { handleLogin, verifyToken } from "./lib/auth-server";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/login") return handleLogin(request, env);
    if (request.method === "POST" && (url.pathname === "/api/ai" || url.pathname === "/api/pdf")) {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
      if (!(await verifyToken(env, token))) return Response.json({ error: "Please log in again." }, { status: 401 });
      return url.pathname === "/api/ai" ? aiHandler({ request, env }) : pdfHandler({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
