import { useState } from "react";
import { Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { api, token } from "@/lib/mail-api";
import { Logo } from "./Logo";

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
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo inverted />
        <div className="text-primary-foreground">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">Sua comunicação, no ritmo da logística.</h2>
          <p className="mt-4 max-w-sm text-primary-foreground/80">E-mail corporativo exclusivo do DFA LOG, conectado com segurança à sua conta.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-primary-foreground/80"><ShieldCheck className="h-4 w-4" /> Conexão criptografada TLS/SSL</div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-foreground/10" />
        <div className="pointer-events-none absolute -bottom-32 right-20 h-72 w-72 rounded-full bg-primary-foreground/10" />
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use seu e-mail e senha @dfalog.com.br</p>

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
      </div>
    </div>
  );
}
