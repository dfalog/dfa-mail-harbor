import { useState } from "react";
import { Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { api, token } from "@/lib/mail-api";
import logo from "@/assets/dfa-log-logo.png.asset.json";

export function LoginScreen({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await api.login(email, password);
      token.set(r.token); setPassword(""); onLogin(r.email);
    } catch (err) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted p-4">
      <div className="pointer-events-none absolute -left-40 top-0 h-full w-96 -skew-x-12 bg-primary/10" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-2/3 w-72 -skew-x-12 bg-navy/5" />
      <div className="relative w-full max-w-md">
        <form onSubmit={submit} className="w-full animate-rise rounded-2xl border-t-4 border-primary bg-card p-8 shadow-soft sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-3">
            <img src={logo.url} alt="DFA LOG Assessoria de Transportes" className="h-14 w-auto" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">DFA Mail</span>
          </div>
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-foreground">Entrar</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Use seu e-mail e senha @dfalog.com.br</p>

          <label className="mt-8 block text-sm font-semibold text-foreground">E-mail</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-input bg-background px-3 transition focus-within:border-primary focus-within:shadow-glow">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@dfalog.com.br" className="h-12 w-full bg-transparent text-sm outline-none" />
          </div>

          <label className="mt-5 block text-sm font-semibold text-foreground">Senha</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-input bg-background px-3 transition focus-within:border-primary focus-within:shadow-glow">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none" />
          </div>

          {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <button disabled={loading} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow transition hover:brightness-105 disabled:opacity-70">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Acessar e-mail
          </button>
          <p className="mt-6 text-center text-xs text-muted-foreground">Sua senha é validada direto no servidor de e-mail e nunca fica salva no navegador.</p>
        </form>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Conexão criptografada TLS/SSL</p>
      </div>
    </div>
  );
}
