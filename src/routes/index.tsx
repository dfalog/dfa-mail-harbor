import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, token } from "@/lib/mail-api";
import { LoginScreen } from "@/components/mail/LoginScreen";
import { Mailbox } from "@/components/mail/Mailbox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DFA Mail — E-mail corporativo DFA LOG" },
      { name: "description", content: "Acesse seu e-mail corporativo @dfalog.com.br com segurança: caixa de entrada, envio, anexos e pastas." },
      { property: "og:title", content: "DFA Mail — E-mail corporativo DFA LOG" },
      { property: "og:description", content: "E-mail corporativo do DFA LOG, conectado com segurança à sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onOut = () => setEmail(null);
    window.addEventListener("dfa-logout", onOut);
    if (token.get()) api.me().then((r) => setEmail(r.email)).catch(() => {}).finally(() => setReady(true));
    else setReady(true);
    return () => window.removeEventListener("dfa-logout", onOut);
  }, []);

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!email) return <LoginScreen onLogin={setEmail} />;
  return (
    <Mailbox
      email={email}
      onLogout={async () => { await api.logout(); token.clear(); setEmail(null); }}
    />
  );
}
