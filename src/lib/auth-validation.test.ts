import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cadastroSchema, loginSchema, novaSenhaSchema } from "./auth-validation";

const signup = { nome: "Ricardo Queiruga", email: "ricardo@example.test", senha: "SenhaSegura123", confirmar: "SenhaSegura123", termos: true };
describe("cadastro e permissões", () => {
  test("cadastro exige nome e e-mail válidos", () => { assert.equal(cadastroSchema.safeParse(signup).success, true); assert.equal(cadastroSchema.safeParse({ ...signup, nome: "", email: "inválido" }).success, false); });
  test("cadastro exige aceitação de termos", () => { assert.equal(cadastroSchema.safeParse({ ...signup, termos: false }).success, false); });
  test("senhas precisam coincidir e ter oito caracteres", () => { assert.equal(cadastroSchema.safeParse({ ...signup, confirmar: "outra" }).success, false); assert.equal(novaSenhaSchema.safeParse({ senha: "1234567", confirmar: "1234567" }).success, false); });
  test("login mantém compatibilidade com senha antiga sem enfraquecer cadastro", () => { assert.equal(loginSchema.safeParse({ email: signup.email, senha: "123456" }).success, true); });
});