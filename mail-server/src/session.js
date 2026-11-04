import crypto from "node:crypto";

// Senhas nunca vão ao navegador nem ficam em texto puro: são cifradas com AES-256-GCM
// e guardadas apenas em memória, indexadas por um token aleatório opaco.
const KEY = Buffer.from(process.env.SESSION_SECRET || "", "hex");
if (KEY.length !== 32) {
  console.error("SESSION_SECRET deve ter 32 bytes em hex (openssl rand -hex 32)");
  process.exit(1);
}
const TTL = Number(process.env.SESSION_TTL_HOURS || 12) * 3600_000;
const sessions = new Map();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return { iv, data, tag: c.getAuthTag() };
}
function decrypt({ iv, data, tag }) {
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

export function createSession(email, password) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { email, secret: encrypt(password), expires: Date.now() + TTL });
  return token;
}
export function getSession(token) {
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return { email: s.email, password: decrypt(s.secret) };
}
export function destroySession(token) { sessions.delete(token); }

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expires < now) sessions.delete(k);
}, 600_000).unref();
