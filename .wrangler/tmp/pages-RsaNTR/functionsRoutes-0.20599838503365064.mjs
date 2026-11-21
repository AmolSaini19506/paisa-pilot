import { onRequestPost as __api_ai_ts_onRequestPost } from "/home/claude/paisa-pilot/functions/api/ai.ts"
import { onRequestPost as __api_pdf_ts_onRequestPost } from "/home/claude/paisa-pilot/functions/api/pdf.ts"

export const routes = [
    {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_ts_onRequestPost],
    },
  {
      routePath: "/api/pdf",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pdf_ts_onRequestPost],
    },
  ]