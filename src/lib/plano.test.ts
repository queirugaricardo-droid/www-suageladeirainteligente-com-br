import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ambienteDoToken, limiteFotos, statusDaAssinatura } from "./plano";

describe("plano", () => {
  test("gratuito tem 2 fotos por mês", () => assert.equal(limiteFotos(false), 2));
  test("plano pago tem 50 fotos por mês", () => assert.equal(limiteFotos(true), 50));
  test("ambiente vem do prefixo do token e nunca cai em live", () => {
    assert.equal(ambienteDoToken("pk_test_x"), "sandbox");
    assert.equal(ambienteDoToken("pk_live_x"), "live");
    assert.equal(ambienteDoToken(undefined), null);
  });
  test("status da assinatura", () => {
    assert.equal(statusDaAssinatura("active", false), "ativo");
    assert.equal(statusDaAssinatura("active", true), "cancelado");
    assert.equal(statusDaAssinatura("past_due", false), "pagamento_pendente");
    assert.equal(statusDaAssinatura("unpaid", false), "expirado");
  });
});
