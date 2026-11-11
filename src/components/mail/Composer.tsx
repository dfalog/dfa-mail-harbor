import { useRef, useState } from "react";
import { Paperclip, Send, X, Loader2, Save, PenLine } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/mail-api";

export type Draft = { to?: string; cc?: string; subject?: string; body?: string; inReplyTo?: string | undefined; references?: string | undefined };

export function Composer({ initial, onClose, onSent }: { initial: Draft; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState(initial.to || "");
  const [cc, setCc] = useState(initial.cc || "");
  const [subject, setSubject] = useState(initial.subject || "");
  const SIG_KEY = "dfa-mail-signature";
  const [sig, setSig] = useState(() => (typeof window !== "undefined" && localStorage.getItem(SIG_KEY)) || "");
  const [editSig, setEditSig] = useState(false);
  const [body, setBody] = useState(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem(SIG_KEY)) || "";
    return s ? "\n\n-- \n" + s + (initial.body || "") : initial.body || "";
  });
  function saveSig(v: string) {
    setSig(v); localStorage.setItem(SIG_KEY, v);
  }
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(draft: boolean) {
    if (!draft && !to.trim()) { toast.error("Informe ao menos um destinatário"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("to", to); fd.append("cc", cc); fd.append("subject", subject);
    fd.append("text", body);
    fd.append("html", body.split("\n").map((l) => l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)).join("<br>"));
    if (initial.inReplyTo) fd.append("inReplyTo", initial.inReplyTo);
    if (initial.references) fd.append("references", initial.references);
    if (draft) fd.append("draft", "true");
    files.forEach((f) => fd.append("attachments", f));
    try {
      await api.send(fd);
      toast.success(draft ? "Rascunho salvo" : "Mensagem enviada");
      onSent();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const field = "w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex h-full w-full max-w-2xl animate-rise flex-col overflow-hidden bg-card shadow-soft sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between bg-gradient-primary px-4 py-3 text-primary-foreground">
          <span className="font-semibold">Nova mensagem</span>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <input className={field} placeholder="Para (separe por vírgula)" value={to} onChange={(e) => setTo(e.target.value)} />
        <input className={field} placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} />
        <input className={field} placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="min-h-64 flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none" value={body} onChange={(e) => setBody(e.target.value)} />
        {editSig && (
          <div className="border-t border-border bg-muted/50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Assinatura (adicionada automaticamente nas novas mensagens)</p>
            <textarea className="h-24 w-full resize-none rounded-lg border border-input bg-card p-2 text-sm outline-none focus:border-primary"
              placeholder={"Nome\nComercial — DFA LOG\n(00) 00000-0000"} value={sig} onChange={(e) => saveSig(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <button onClick={() => { if (sig) setBody(body + "\n\n-- \n" + sig); setEditSig(false); }} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Inserir nesta mensagem</button>
              <button onClick={() => setEditSig(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Fechar</button>
            </div>
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                {f.name}
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remover anexo"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button disabled={busy} onClick={() => submit(false)} className="flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
          </button>
          <button disabled={busy} onClick={() => submit(true)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted">
            <Save className="h-4 w-4" /> Rascunho
          </button>
          <button onClick={() => setEditSig(!editSig)} className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted" title="Assinatura">
            <PenLine className="h-4 w-4" /> Assinatura
          </button>
          <button onClick={() => fileRef.current?.click()} className=" rounded-xl p-2.5 text-muted-foreground hover:bg-muted" aria-label="Anexar">
            <Paperclip className="h-5 w-5" />
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}
