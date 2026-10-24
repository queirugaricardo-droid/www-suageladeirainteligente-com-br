import { describe, expect, it } from "vitest";
import { ambienteDoToken, limiteFotos, statusDaAssinatura } from "./plano";

describe("plano", () => {
  it("gratuito tem 2 fotos por mês", () => expect(limiteFotos(false)).toBe(2));
  it("plano pago tem 50 fotos por mês", () => expect(limiteFotos(true)).toBe(50));
  it("ambiente vem do prefixo do token e nunca cai em live", () => {
    expect(ambienteDoToken("pk_test_x")).toBe("sandbox");
    expect(ambienteDoToken("pk_live_x")).toBe("live");
    expect(ambienteDoToken(undefined)).toBeNull();
  });
  it("assinatura ativa marcada para cancelar fica como cancelada", () => {
    expect(statusDaAssinatura("active", false)).toBe("ativo");
    expect(statusDaAssinatura("active", true)).toBe("cancelado");
    expect(statusDaAssinatura("past_due", false)).toBe("pagamento_pendente");
    expect(statusDaAssinatura("unpaid", false)).toBe("expirado");
  });
});
