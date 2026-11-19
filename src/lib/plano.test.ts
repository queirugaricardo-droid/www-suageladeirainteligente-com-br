import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { imagensAnaliseSchema } from "./plano";

describe("plano", () => {
  test("permite mais de duas fotos na mesma análise", () => {
    const imagens = Array.from({ length: 3 }, () => "a".repeat(50));
    assert.equal(imagensAnaliseSchema.parse({ imagens }).imagens.length, 3);
  });
  test("permite até seis fotos por solicitação sem criar limite mensal", () => {
    const imagens = Array.from({ length: 6 }, () => "a".repeat(50));
    assert.equal(imagensAnaliseSchema.parse({ imagens }).imagens.length, 6);
  });
  test("bloqueia payload com mais de seis fotos na mesma solicitação", () => {
    const imagens = Array.from({ length: 7 }, () => "a".repeat(50));
    assert.equal(imagensAnaliseSchema.safeParse({ imagens }).success, false);
  });
  test("continua exigindo pelo menos uma imagem válida", () => {
    assert.equal(imagensAnaliseSchema.safeParse({ imagens: [] }).success, false);
    assert.equal(imagensAnaliseSchema.safeParse({ imagens: ["inválida"] }).success, false);
  });
});
