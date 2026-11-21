// Cloudflare Worker entry: API routes + static Next.js export served from ASSETS
import { onRequestPost as aiHandler } from "./functions/api/ai";
import { onRequestPost as pdfHandler } from "./functions/api/pdf";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/ai") return aiHandler({ request, env });
    if (request.method === "POST" && url.pathname === "/api/pdf") return pdfHandler({ request, env });
    return env.ASSETS.fetch(request);
  },
};
