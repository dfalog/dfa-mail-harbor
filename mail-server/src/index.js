import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { createSession, getSession, destroySession } from "./session.js";

const env = process.env;
const IMAP = { host: env.IMAP_HOST || "imap.hostinger.com", port: Number(env.IMAP_PORT || 993) };
const SMTP = { host: env.SMTP_HOST || "smtp.hostinger.com", port: Number(env.SMTP_PORT || 465) };
const DOMAINS = (env.ALLOWED_DOMAINS || "dfalog.com.br").split(",").map((d) => d.trim().toLowerCase());

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()), allowedHeaders: ["Authorization", "Content-Type"] }));
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

const imapClient = (user, pass) =>
  new ImapFlow({ ...IMAP, secure: true, auth: { user, pass }, logger: false });
const smtpClient = (user, pass) =>
  nodemailer.createTransport({ ...SMTP, secure: true, auth: { user, pass } });

// Resolve pastas especiais pelo atributo IMAP SPECIAL-USE (não por nomes inventados)
async function folderMap(client) {
  const list = await client.list();
  const map = { inbox: "INBOX" };
  const uses = { "\\Sent": "sent", "\\Drafts": "drafts", "\\Archive": "archive", "\\Junk": "spam", "\\Trash": "trash", "\\Flagged": "starred" };
  for (const f of list) if (f.specialUse && uses[f.specialUse]) map[uses[f.specialUse]] = f.path;
  // Hostinger não traz pasta de arquivo por padrão: cria "Archive" com o delimitador do servidor
  if (!map.archive) {
    const delim = list.find((f) => f.path === "INBOX")?.delimiter || ".";
    const path = map.sent?.startsWith("INBOX" + delim) ? `INBOX${delim}Archive` : "Archive";
    if (!list.some((f) => f.path === path)) await client.mailboxCreate(path).catch(() => {});
    map.archive = path;
  }
  delete map.starred;
  return { map, list };
}

async function withImap(req, res, fn) {
  const client = imapClient(req.user.email, req.user.password);
  try {
    await client.connect();
    const out = await fn(client);
    res.json(out);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Falha na operação de e-mail" });
  } finally {
    client.logout().catch(() => {});
  }
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const s = getSession(token);
  if (!s) return res.status(401).json({ error: "Sessão expirada" });
  req.user = s; req.token = token; next();
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10 });

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/login", loginLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password || !DOMAINS.includes(email.split("@")[1]))
    return res.status(400).json({ error: "Use seu e-mail corporativo @dfalog.com.br" });
  const client = imapClient(email, password);
  try {
    await client.connect();
    await client.logout();
    res.json({ token: createSession(email, password), email });
  } catch {
    res.status(401).json({ error: "E-mail ou senha incorretos" });
  }
});

app.post("/auth/logout", auth, (req, res) => { destroySession(req.token); res.json({ ok: true }); });
app.get("/auth/me", auth, (req, res) => res.json({ email: req.user.email }));

app.get("/folders", auth, (req, res) =>
  withImap(req, res, async (c) => {
    const { map, list } = await folderMap(c);
    const special = new Set(Object.values(map));
    const custom = list.filter((f) => !special.has(f.path) && !f.flags.has("\\Noselect")).map((f) => ({ path: f.path, name: f.name }));
    const counts = {};
    for (const [k, p] of Object.entries(map)) {
      try { const st = await c.status(p, { unseen: true }); counts[k] = st.unseen; } catch {}
    }
    return { special: map, custom, counts };
  }),
);

app.post("/folders", auth, (req, res) =>
  withImap(req, res, async (c) => { await c.mailboxCreate(String(req.body.name)); return { ok: true }; }),
);
app.delete("/folders", auth, (req, res) =>
  withImap(req, res, async (c) => { await c.mailboxDelete(String(req.query.path)); return { ok: true }; }),
);

app.get("/messages", auth, (req, res) =>
  withImap(req, res, async (c) => {
    const folder = String(req.query.folder || "INBOX");
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const size = 40;
    const lock = await c.getMailboxLock(folder);
    try {
      const crit = q ? { or: [{ from: q }, { subject: q }, { body: q }] } : { all: true };
      if (req.query.flagged === "1") crit.flagged = true;
      let uids = await c.search(crit, { uid: true });
      uids = (uids || []).sort((a, b) => b - a);
      const slice = uids.slice((page - 1) * size, page * size);
      const items = [];
      if (slice.length)
        for await (const m of c.fetch(slice, { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true }, { uid: true }))
          items.push({
            uid: m.uid,
            subject: m.envelope.subject || "(sem assunto)",
            from: m.envelope.from?.[0] || null,
            to: m.envelope.to || [],
            date: m.envelope.date || m.internalDate,
            seen: m.flags.has("\\Seen"),
            flagged: m.flags.has("\\Flagged"),
            hasAttachments: JSON.stringify(m.bodyStructure || {}).includes('"disposition":"attachment"'),
          });
      items.sort((a, b) => b.uid - a.uid);
      return { items, total: uids.length, page, pageSize: size };
    } finally { lock.release(); }
  }),
);

app.get("/messages/:uid", auth, (req, res) =>
  withImap(req, res, async (c) => {
    const lock = await c.getMailboxLock(String(req.query.folder || "INBOX"));
    try {
      const msg = await c.fetchOne(req.params.uid, { source: true, flags: true }, { uid: true });
      const p = await simpleParser(msg.source);
      await c.messageFlagsAdd(req.params.uid, ["\\Seen"], { uid: true });
      return {
        uid: Number(req.params.uid),
        subject: p.subject || "(sem assunto)",
        from: p.from?.value || [], to: p.to?.value || [], cc: p.cc?.value || [],
        date: p.date, messageId: p.messageId, references: p.references,
        html: p.html || null, text: p.text || "",
        flagged: msg.flags.has("\\Flagged"),
        attachments: p.attachments.map((a, i) => ({ index: i, filename: a.filename || `anexo-${i + 1}`, size: a.size, contentType: a.contentType })),
      };
    } finally { lock.release(); }
  }),
);

app.get("/messages/:uid/attachments/:index", auth, async (req, res) => {
  const c = imapClient(req.user.email, req.user.password);
  try {
    await c.connect();
    const lock = await c.getMailboxLock(String(req.query.folder || "INBOX"));
    try {
      const msg = await c.fetchOne(req.params.uid, { source: true }, { uid: true });
      const a = (await simpleParser(msg.source)).attachments[Number(req.params.index)];
      if (!a) return res.status(404).end();
      res.setHeader("Content-Type", a.contentType);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(a.filename || "anexo")}`);
      res.send(a.content);
    } finally { lock.release(); }
  } catch { res.status(500).end(); } finally { c.logout().catch(() => {}); }
});

// Ações: seen, unseen, flag, unflag, move (to), delete
app.post("/messages/action", auth, (req, res) =>
  withImap(req, res, async (c) => {
    const { folder = "INBOX", uids = [], action, to } = req.body || {};
    const lock = await c.getMailboxLock(folder);
    try {
      const set = uids.map(Number);
      if (action === "seen") await c.messageFlagsAdd(set, ["\\Seen"], { uid: true });
      else if (action === "unseen") await c.messageFlagsRemove(set, ["\\Seen"], { uid: true });
      else if (action === "flag") await c.messageFlagsAdd(set, ["\\Flagged"], { uid: true });
      else if (action === "unflag") await c.messageFlagsRemove(set, ["\\Flagged"], { uid: true });
      else if (action === "move") await c.messageMove(set, to, { uid: true });
      else if (action === "delete") {
        const { map } = await folderMap(c);
        if (map.trash && folder !== map.trash) await c.messageMove(set, map.trash, { uid: true });
        else await c.messageDelete(set, { uid: true });
      } else throw new Error("ação inválida");
      return { ok: true };
    } finally { lock.release(); }
  }),
);

app.post("/send", auth, upload.array("attachments"), async (req, res) => {
  const { to, cc, bcc, subject, html, text, inReplyTo, references, draft } = req.body;
  const mail = {
    from: req.user.email, to, cc: cc || undefined, bcc: bcc || undefined,
    subject, html, text, inReplyTo: inReplyTo || undefined, references: references || undefined,
    attachments: (req.files || []).map((f) => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype })),
  };
  try {
    // Gera a mensagem MIME para salvar uma cópia em Enviados/Rascunhos via IMAP
    const raw = await new Promise((ok, ko) =>
      nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(mail, (e, i) => (e ? ko(e) : ok(i.message))));
    if (draft !== "true") await smtpClient(req.user.email, req.user.password).sendMail(mail);
    const c = imapClient(req.user.email, req.user.password);
    try {
      await c.connect();
      const { map } = await folderMap(c);
      const target = draft === "true" ? map.drafts : map.sent;
      if (target) await c.append(target, raw, draft === "true" ? ["\\Draft"] : ["\\Seen"]);
    } finally { c.logout().catch(() => {}); }
    res.json({ ok: true });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Não foi possível enviar a mensagem" });
  }
});

const port = Number(env.PORT || 4000);
app.listen(port, () => console.log(`DFA Mail server em :${port}`));
