// Cliente do servidor DFA Mail. O navegador guarda apenas um token opaco — nunca a senha.
const BASE = (import.meta.env["VITE_MAIL_API_URL"] as string | undefined) || "http://localhost:4000";
const KEY = "dfa-mail-token";

export type Address = { name?: string; address?: string };
export type MessageSummary = {
  uid: number; subject: string; from: Address | null; to: Address[]; date: string;
  seen: boolean; flagged: boolean; hasAttachments: boolean;
};
export type MessageDetail = {
  uid: number; subject: string; from: Address[]; to: Address[]; cc: Address[]; date: string;
  messageId?: string; references?: string | string[]; html: string | null; text: string; flagged: boolean;
  attachments: { index: number; filename: string; size: number; contentType: string }[];
};
export type Folders = {
  special: Record<string, string>; custom: { path: string; name: string }[]; counts: Record<string, number>;
};

export const token = {
  get: () => (typeof window === "undefined" ? null : sessionStorage.getItem(KEY)),
  set: (t: string) => sessionStorage.setItem(KEY, t),
  clear: () => sessionStorage.removeItem(KEY),
};

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const t = token.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let r: Response;
  try {
    r = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new Error("Servidor de e-mail indisponível. Verifique se o servidor DFA Mail está online.");
  }
  if (r.status === 401) { token.clear(); window.dispatchEvent(new Event("dfa-logout")); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro de conexão com o servidor");
  return r.json();
}

const qs = (o: Record<string, string | number | undefined>) =>
  "?" + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; email: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req("/auth/logout", { method: "POST" }).catch(() => {}),
  me: () => req<{ email: string }>("/auth/me"),
  folders: () => req<Folders>("/folders"),
  createFolder: (name: string) => req("/folders", { method: "POST", body: JSON.stringify({ name }) }),
  deleteFolder: (path: string) => req("/folders" + qs({ path }), { method: "DELETE" }),
  list: (folder: string, q: string, page = 1, flagged = false) =>
    req<{ items: MessageSummary[]; total: number; page: number; pageSize: number }>(
      "/messages" + qs({ folder, q, page, flagged: flagged ? 1 : undefined })),
  get: (folder: string, uid: number) => req<MessageDetail>(`/messages/${uid}` + qs({ folder })),
  action: (folder: string, uids: number[], action: string, to?: string) =>
    req("/messages/action", { method: "POST", body: JSON.stringify({ folder, uids, action, to }) }),
  send: (fd: FormData) => req("/send", { method: "POST", body: fd }),
  async download(folder: string, uid: number, index: number, filename: string) {
    const r = await fetch(BASE + `/messages/${uid}/attachments/${index}` + qs({ folder }), {
      headers: { Authorization: `Bearer ${token.get()}` },
    });
    if (!r.ok) throw new Error("Falha ao baixar anexo");
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

export const fmtAddr = (a?: Address | null) => (a ? a.name || a.address || "" : "");
