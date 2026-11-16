import { describe, it, expect } from "vitest";
import { planMoves } from "@/lib/mail-rules";
const m = (uid: number, from: string, subject: string) =>
  ({ uid, subject, from: { address: from }, to: [], date: "", seen: false, flagged: false, hasAttachments: false });
describe("regras de pasta", () => {
  it("move por remetente e assunto, ignorando maiúsculas", () => {
    const plan = planMoves(
      [m(1, "banco@itau.com", "Fatura"), m(2, "x@y.com", "Projeto Alfa"), m(3, "a@b.com", "Oi")],
      [{ field: "from", text: "ITAU", folder: "Financeiro" }, { field: "subject", text: "projeto", folder: "Projetos" }],
    );
    expect(plan).toEqual({ Financeiro: [1], Projetos: [2] });
  });
});
