import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cadastroSchema, loginSchema, possuiAcessoPago, novaSenhaSchema, type AssinaturaAcesso } from "./auth-validation";

const signup = { nome: "Ricardo Queiruga", email: "ricardo@example.test", senha: "SenhaSegura123", confirmar: "SenhaSegura123", termos: true };
const assinatura: AssinaturaAcesso = { plano: "mensal", status: "ativo", acesso_inicio: "2026-10-01T00:00:00Z", acesso_fim: "2026-11-01T00:00:00Z", provedor: "provedor", provedor_assinatura_id: "sub-confirmada", pagamento_verificado_em: "2026-10-01T00:00:00Z" };
const hoje = Date.parse("2026-10-24T00:00:00Z");
describe("cadastro e permissões", () => {
  test("cadastro exige nome e e-mail válidos", () => { assert.equal(cadastroSchema.safeParse(signup).success, true); assert.equal(cadastroSchema.safeParse({ ...signup, nome: "", email: "inválido" }).success, false); });
  test("cadastro exige aceitação de termos", () => { assert.equal(cadastroSchema.safeParse({ ...signup, termos: false }).success, false); });
  test("senhas precisam coincidir e ter oito caracteres", () => { assert.equal(cadastroSchema.safeParse({ ...signup, confirmar: "outra" }).success, false); assert.equal(novaSenhaSchema.safeParse({ senha: "1234567", confirmar: "1234567" }).success, false); });
  test("login mantém compatibilidade com senha antiga sem enfraquecer cadastro", () => { assert.equal(loginSchema.safeParse({ email: signup.email, senha: "123456" }).success, true); });
  test("gratuito ou sem confirmação não ganha acesso pago", () => { assert.equal(possuiAcessoPago(null, hoje), false); assert.equal(possuiAcessoPago({ ...assinatura, pagamento_verificado_em: null }, hoje), false); assert.equal(possuiAcessoPago({ ...assinatura, plano: "gratuito" }, hoje), false); });
  test("estados sem pagamento ativo são bloqueados", () => { for (const status of ["gratuito", "aguardando_confirmacao", "expirado", "pagamento_pendente"]) assert.equal(possuiAcessoPago({ ...assinatura, status }, hoje), false); });
  test("assinatura confirmada só vale durante o período pago", () => { assert.equal(possuiAcessoPago(assinatura, hoje), true); assert.equal(possuiAcessoPago(assinatura, Date.parse("2026-11-01T00:00:00Z")), false); assert.equal(possuiAcessoPago(assinatura, Date.parse("2026-09-30T00:00:00Z")), false); });
  test("cancelamento preserva apenas período já pago", () => { assert.equal(possuiAcessoPago({ ...assinatura, status: "cancelado" }, hoje), true); assert.equal(possuiAcessoPago({ ...assinatura, status: "cancelado" }, Date.parse("2026-11-02T00:00:00Z")), false); });
});