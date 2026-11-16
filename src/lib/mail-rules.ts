import type { MessageSummary } from "./mail-api";

// Regras de filtro: e-mails recebidos que combinam são movidos para a pasta escolhida.
export type Rule = { field: "from" | "subject"; text: string; folder: string };
const KEY = "dfa-mail-rules";

export const loadRules = (): Rule[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
export const saveRules = (r: Rule[]) => localStorage.setItem(KEY, JSON.stringify(r));

export function matchRule(m: MessageSummary, rules: Rule[]): Rule | undefined {
  return rules.find((r) => {
    const t = r.text.trim().toLowerCase();
    if (!t || !r.folder) return false;
    const v = r.field === "from"
      ? `${m.from?.name || ""} ${m.from?.address || ""}`
      : m.subject || "";
    return v.toLowerCase().includes(t);
  });
}

// Agrupa UIDs por pasta de destino.
export function planMoves(items: MessageSummary[], rules: Rule[]) {
  const out: Record<string, number[]> = {};
  for (const m of items) { const r = matchRule(m, rules); if (r) (out[r.folder] ||= []).push(m.uid); }
  return out;
}
