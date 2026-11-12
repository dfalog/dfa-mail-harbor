import { useCallback, useEffect, useState } from "react";
import {
  Inbox, Send, FileText, Archive, ShieldAlert, Trash2, Star, Search, RefreshCw, PenSquare, LogOut, Menu,
  Folder, FolderPlus, Paperclip, Reply, ReplyAll, Forward, MailOpen, Mail, ArrowLeft, Download, Loader2, X, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { api, fmtAddr, type Folders, type MessageDetail, type MessageSummary } from "@/lib/mail-api";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Composer, type Draft } from "./Composer";

const SPECIAL = [
  { key: "inbox", label: "Caixa de entrada", icon: Inbox },
  { key: "starred", label: "Favoritos", icon: Star },
  { key: "sent", label: "Enviados", icon: Send },
  { key: "drafts", label: "Rascunhos", icon: FileText },
  { key: "archive", label: "Arquivados", icon: Archive },
  { key: "spam", label: "Spam", icon: ShieldAlert },
  { key: "trash", label: "Lixeira", icon: Trash2 },
] as const;

const fmtDate = (d: string) => {
  const dt = new Date(d); const now = new Date();
  return dt.toDateString() === now.toDateString()
    ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};
const initials = (s: string) => (s.trim()[0] || "?").toUpperCase();

export function Mailbox({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [folders, setFolders] = useState<Folders | null>(null);
  const [view, setView] = useState<string>("inbox");
  const [q, setQ] = useState(""); const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ items: MessageSummary[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<MessageDetail | null>(null);
  const [opening, setOpening] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [compose, setCompose] = useState<Draft | null>(null);
  const [nav, setNav] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sig, setSig] = useState("");
  useEffect(() => { setSig(localStorage.getItem("dfa-mail-signature") || ""); }, []);

  const path = view === "starred" ? "INBOX" : folders?.special[view] || view;

  const loadFolders = useCallback(() => api.folders().then(setFolders).catch((e) => toast.error(e.message)), []);
  const loadList = useCallback(async () => {
    if (!folders) return;
    setLoading(true);
    try { setList(await api.list(path, search, page, view === "starred")); setSelected([]); }
    catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }, [folders, path, search, page, view]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { const t = setInterval(() => { loadList(); loadFolders(); }, 60_000); return () => clearInterval(t); }, [loadList, loadFolders]);

  const refresh = () => { loadFolders(); loadList(); };
  const go = (v: string) => { setView(v); setPage(1); setOpen(null); setNav(false); };

  async function openMsg(m: MessageSummary) {
    setOpening(true);
    setOpen({ uid: m.uid, subject: m.subject, from: m.from ? [m.from] : [], to: m.to, cc: [], date: m.date, html: null, text: "", flagged: m.flagged, attachments: [], loading: true } as MessageDetail);
    try {
      setOpen(await api.get(path, m.uid));
      setList((l) => l && { ...l, items: l.items.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)) });
    } catch (e) { setOpen(null); toast.error((e as Error).message); } finally { setOpening(false); }
  }

  async function act(uids: number[], action: string, to?: string) {
    try {
      await api.action(path, uids, action, to);
      if (["move", "delete"].includes(action)) setOpen(null);
      if (open && uids.includes(open.uid) && (action === "flag" || action === "unflag")) setOpen({ ...open, flagged: action === "flag" });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  function replyDraft(mode: "reply" | "all" | "fwd"): Draft {
    const m = open!;
    const quote = `\n\n---- Em ${new Date(m.date).toLocaleString("pt-BR")}, ${fmtAddr(m.from[0])} escreveu:\n` + (m.text || "").split("\n").map((l) => "> " + l).join("\n");
    const refs = [...(Array.isArray(m.references) ? m.references : m.references ? [m.references] : []), m.messageId].filter(Boolean).join(" ");
    if (mode === "fwd") return { subject: "Enc: " + m.subject, body: `\n\n---- Mensagem encaminhada ----\nDe: ${m.from.map((a) => a.address).join(", ")}\nAssunto: ${m.subject}\n\n${m.text}` };
    const others = [...m.to, ...m.cc].map((a) => a.address).filter((a) => a && a.toLowerCase() !== email);
    return {
      to: m.from.map((a) => a.address).join(", "), cc: mode === "all" ? others.join(", ") : "",
      subject: m.subject.startsWith("Re:") ? m.subject : "Re: " + m.subject, body: quote, inReplyTo: m.messageId, references: refs,
    };
  }

  async function newFolder() {
    const name = prompt("Nome da nova pasta");
    if (!name) return;
    try { await api.createFolder(name); toast.success("Pasta criada"); loadFolders(); } catch (e) { toast.error((e as Error).message); }
  }
  async function delFolder(p: string) {
    if (!confirm(`Excluir a pasta "${p}" e todas as suas mensagens?`)) return;
    try { await api.deleteFolder(p); if (view === p) go("inbox"); loadFolders(); } catch (e) { toast.error((e as Error).message); }
  }

  const title = SPECIAL.find((s) => s.key === view)?.label || folders?.custom.find((f) => f.path === view)?.name || view;
  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-sidebar p-4">
      <div className="flex items-center justify-between px-2 py-1"><Logo /><button className="lg:hidden" onClick={() => setNav(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <button onClick={() => { setCompose({}); setNav(false); }} className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:-translate-y-0.5">
        <PenSquare className="h-4 w-4" /> Escrever
      </button>
      <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
        {SPECIAL.filter((s) => s.key === "starred" || folders?.special[s.key]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => go(key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            view === key ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-muted")}>
            <Icon className={cn("h-4 w-4", view === key && "text-primary")} /> <span className="flex-1 text-left">{label}</span>
            {!!folders?.counts[key] && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{folders.counts[key]}</span>}
          </button>
        ))}
        <div className="flex items-center justify-between px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pastas <button onClick={newFolder} aria-label="Nova pasta" className="hover:text-primary"><FolderPlus className="h-4 w-4" /></button>
        </div>
        {folders?.custom.map((f) => (
          <div key={f.path} className={cn("group flex items-center rounded-xl", view === f.path ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-muted")}>
            <button onClick={() => go(f.path)} className="flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium"><Folder className="h-4 w-4" />{f.name}</button>
            <button onClick={() => delFolder(f.path)} className="px-3 opacity-0 transition group-hover:opacity-100" aria-label="Excluir pasta"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
          </div>
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">{initials(email)}</div>
        <span className="flex-1 truncate text-sm font-medium">{email}</span>
        <button onClick={() => { setSettings(true); setNav(false); }} aria-label="Configurações" title="Configurações" className="text-muted-foreground hover:text-primary"><Settings className="h-4 w-4" /></button>
        <button onClick={onLogout} aria-label="Sair" className="text-muted-foreground hover:text-destructive"><LogOut className="h-4 w-4" /></button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-muted text-foreground">
      <div className="hidden lg:block">{sidebar}</div>
      {nav && <div className="fixed inset-0 z-40 flex bg-foreground/20 lg:hidden" onClick={() => setNav(false)}><div className="animate-rise shadow-soft" onClick={(e) => e.stopPropagation()}>{sidebar}</div></div>}

      <section className={cn("flex min-w-0 flex-1 flex-col border-r border-border bg-card md:max-w-md xl:max-w-lg", open && "hidden md:flex")}>
        <header className="flex items-center gap-2 border-b border-border p-3">
          <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setNav(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q); }} className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar remetente, assunto, conteúdo" className="h-10 w-full bg-transparent text-sm outline-none" />
            {search && <button type="button" onClick={() => { setQ(""); setSearch(""); }} aria-label="Limpar"><X className="h-4 w-4 text-muted-foreground" /></button>}
          </form>
          <button onClick={refresh} className="rounded-lg p-2 hover:bg-muted" aria-label="Atualizar"><RefreshCw className={cn("h-5 w-5 text-muted-foreground", loading && "animate-spin text-primary")} /></button>
        </header>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-navy">{title}</h1>
          {selected.length > 0 ? (
            <div className="flex gap-1">
              <IconBtn label="Marcar como lida" onClick={() => act(selected, "seen")}><MailOpen /></IconBtn>
              <IconBtn label="Marcar como não lida" onClick={() => act(selected, "unseen")}><Mail /></IconBtn>
              {folders?.special["archive"] && <IconBtn label="Arquivar" onClick={() => act(selected, "move", folders.special["archive"])}><Archive /></IconBtn>}
              <IconBtn label="Excluir" onClick={() => act(selected, "delete")}><Trash2 /></IconBtn>
            </div>
          ) : <span className="text-xs text-muted-foreground">{list?.total ?? 0} mensagens</span>}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list?.items.map((m) => (
            <li key={m.uid} className={cn("group flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 transition hover:bg-muted/60",
              open?.uid === m.uid && "bg-accent/60", !m.seen && "bg-secondary/60 border-l-2 border-l-primary")} onClick={() => openMsg(m)} onMouseEnter={() => api.get(path, m.uid).catch(() => {})}>
              <input type="checkbox" className="mt-3 accent-primary" checked={selected.includes(m.uid)} onClick={(e) => e.stopPropagation()}
                onChange={(e) => setSelected(e.target.checked ? [...selected, m.uid] : selected.filter((u) => u !== m.uid))} />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{initials(fmtAddr(m.from))}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("flex-1 truncate text-sm", !m.seen ? "font-bold text-foreground" : "text-foreground/80")}>
                    {view === "sent" || view === "drafts" ? "Para: " + m.to.map(fmtAddr).join(", ") : fmtAddr(m.from)}
                  </span>
                  <span className={cn("shrink-0 text-xs", !m.seen ? "font-semibold text-primary" : "text-muted-foreground")}>{fmtDate(m.date)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={cn("flex-1 truncate text-sm", !m.seen ? "font-semibold" : "text-muted-foreground")}>{m.subject}</span>
                  {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                  <button onClick={(e) => { e.stopPropagation(); act([m.uid], m.flagged ? "unflag" : "flag"); }} aria-label="Favoritar">
                    <Star className={cn("h-4 w-4", m.flagged ? "fill-primary text-primary" : "text-muted-foreground/50 hover:text-primary")} />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {list && list.items.length === 0 && <li className="p-12 text-center text-sm text-muted-foreground">Nenhuma mensagem aqui.</li>}
          {!list && <li className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></li>}
        </ul>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg px-3 py-1 hover:bg-muted disabled:opacity-40">Anterior</button>
            <span className="text-muted-foreground">{page} de {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg px-3 py-1 hover:bg-muted disabled:opacity-40">Próxima</button>
          </div>
        )}
      </section>

      <main className={cn("min-w-0 flex-1 flex-col bg-background", open ? "flex" : "hidden md:flex")}>
                {!open && !opening && (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent"><Mail className="h-9 w-9 text-primary" /></div>
            <p className="mt-4 text-sm">Selecione uma mensagem para ler</p>
          </div>
        )}
        {open && (
          <div key={open.uid} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 p-3">
              <button className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setOpen(null)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></button>
              <button onClick={() => setCompose(replyDraft("reply"))} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90"><Reply className="h-4 w-4" /><span className="hidden sm:inline">Responder</span></button>
              <button onClick={() => setCompose(replyDraft("all"))} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition border border-border bg-card text-navy hover:border-primary hover:text-primary"><ReplyAll className="h-4 w-4" /><span className="hidden sm:inline">Responder a todos</span></button>
              <button onClick={() => setCompose(replyDraft("fwd"))} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition border border-border bg-card text-navy hover:border-primary hover:text-primary"><Forward className="h-4 w-4" /><span className="hidden sm:inline">Encaminhar</span></button>
              <div className="flex-1" />
              <IconBtn label="Favoritar" onClick={() => act([open.uid], open.flagged ? "unflag" : "flag")}><Star className={open.flagged ? "fill-primary text-primary" : ""} /></IconBtn>
              <IconBtn label="Marcar como não lida" onClick={() => act([open.uid], "unseen")}><Mail /></IconBtn>
              {folders?.special["archive"] && path !== folders.special["archive"] && <IconBtn label="Arquivar" onClick={() => act([open.uid], "move", folders.special["archive"])}><Archive /></IconBtn>}
              {folders?.special["spam"] && path !== folders.special["spam"] && <IconBtn label="Spam" onClick={() => act([open.uid], "move", folders.special["spam"])}><ShieldAlert /></IconBtn>}
              {folders?.custom.length ? (
                <select className="rounded-lg bg-muted px-2 py-1.5 text-xs" value="" onChange={(e) => e.target.value && act([open.uid], "move", e.target.value)}>
                  <option value="">Mover para…</option>
                  {folders.custom.map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
                  {folders.special["inbox"] !== path && <option value="INBOX">Caixa de entrada</option>}
                </select>
              ) : null}
              <IconBtn label="Excluir" onClick={() => act([open.uid], "delete")}><Trash2 /></IconBtn>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-bold tracking-tight text-navy">{open.subject}</h2>
              <div className="mt-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary font-bold text-primary-foreground">{initials(fmtAddr(open.from[0]))}</div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">{fmtAddr(open.from[0])} <span className="font-normal text-muted-foreground">&lt;{open.from[0]?.address}&gt;</span></div>
                  <div className="truncate text-muted-foreground">Para: {open.to.map((a) => a.address).join(", ")}{open.cc.length ? ` · Cc: ${open.cc.map((a) => a.address).join(", ")}` : ""}</div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(open.date).toLocaleString("pt-BR")}</span>
              </div>
              {open.attachments.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {open.attachments.map((a) => (
                    <button key={a.index} onClick={() => api.download(path, open.uid, a.index, a.filename).catch((e) => toast.error(e.message))}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition hover:border-primary hover:shadow-soft">
                      <Paperclip className="h-4 w-4 text-primary" /> <span className="max-w-48 truncate">{a.filename}</span>
                      <span className="text-xs text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span><Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
                {opening ? (
                  <div className="space-y-3 p-6">{[90, 75, 82, 60].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-border" style={{ width: w + "%" }} />)}</div>
                ) : open.html ? (
                  <iframe title="Conteúdo" sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[65vh] w-full bg-card"
                    srcDoc={`<base target="_blank"><style>html{background:#fff;color:#111}body{font-family:system-ui,sans-serif;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}</style>${open.html}`} />
                ) : <pre className="whitespace-pre-wrap p-5 font-sans text-sm">{open.text}</pre>}
              </div>
            </div>
          </div>
        )}
      </main>

      {settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={() => setSettings(false)}>
          <div className="w-full max-w-lg animate-rise rounded-2xl bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-navy">Configurações</h2><button onClick={() => setSettings(false)} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <div className="mb-2 font-semibold text-navy">Configurações da conta</div>
              {[["E-mail", email], ["Usuário", email], ["Entrada (IMAP)", "imap.hostinger.com · porta 993 · SSL/TLS"], ["Saída (SMTP)", "smtp.hostinger.com · porta 465 · SSL/TLS"], ["Autenticação", "Senha normal (a mesma do login)"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-t border-border py-1.5 first-of-type:border-t-0">
                  <span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </div>
            <label className="mt-5 block text-sm font-semibold">Assinatura</label>
            <p className="text-xs text-muted-foreground">Adicionada automaticamente em toda mensagem nova.</p>
            <textarea className="mt-2 h-32 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
              placeholder={"Nome\nComercial — DFA LOG\n(00) 00000-0000"} value={sig} onChange={(e) => setSig(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSettings(false)} className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => { localStorage.setItem("dfa-mail-signature", sig); setSettings(false); toast.success("Assinatura salva"); }} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {compose && <Composer initial={compose} onClose={() => setCompose(null)} onSent={() => { setCompose(null); refresh(); }} />}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="rounded-lg p-2 text-navy transition hover:bg-accent hover:text-accent-foreground [&>svg]:h-5 [&>svg]:w-5">
      {children}
    </button>
  );
}
