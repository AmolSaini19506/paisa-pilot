// Server-side session tokens for the Worker: HMAC-signed, expiring, no database needed.
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function key(secret: string | null) {
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function authConfig(env: any) {
  return {
    email: String(env.JUDGE_EMAIL ?? "judge@paisapilot.app").toLowerCase(),
    password: String(env.JUDGE_PASSWORD ?? "chai2026"),
    // AUTH_SECRET must be set as a Worker secret. The dev fallback only works when DEV_AUTH=1 (wrangler dev).
    secret: env.AUTH_SECRET ? String(env.AUTH_SECRET) : env.DEV_AUTH === "1" ? "paisa-pilot-dev-secret" : null,
  };
}

const TTL = 7 * 24 * 3600;

export async function issueToken(env: any, email: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ sub: email, exp: Math.floor(Date.now() / 1000) + TTL })));
  const sig = await crypto.subtle.sign("HMAC", await key(authConfig(env).secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(env: any, token: string | null): Promise<boolean> {
  if (!token || !authConfig(env).secret) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = b64url(await crypto.subtle.sign("HMAC", await key(authConfig(env).secret), enc.encode(body)));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return false;
  try {
    const { exp } = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function handleLogin(request: Request, env: any): Promise<Response> {
  let email = "", password = "";
  try { ({ email = "", password = "" } = await request.json()); } catch {}
  const cfg = authConfig(env);
  if (!cfg.secret) return Response.json({ error: "Login isn't set up on the server yet." }, { status: 503 });
  if (String(email).trim().toLowerCase() !== cfg.email || password !== cfg.password) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }
  return Response.json({ token: await issueToken(env, cfg.email) });
}
