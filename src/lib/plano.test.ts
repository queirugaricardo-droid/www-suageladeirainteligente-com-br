import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { imagensAnaliseSchema } from "./plano";

describe("plano", () => {
  test("permite mais de duas fotos na mesma análise", () => {
    const imagens = Array.from({ length: 3 }, () => "a".repeat(50));
    assert.equal(imagensAnaliseSchema.parse({ imagens }).imagens.length, 3);
  });
  test("não aplica teto de quantidade de fotos", () => {
    const imagens = Array.from({ length: 1001 }, () => "a".repeat(50));
    assert.equal(imagensAnaliseSchema.parse({ imagens }).imagens.length, 1001);
  });
  test("continua exigindo pelo menos uma imagem válida", () => {
    assert.equal(imagensAnaliseSchema.safeParse({ imagens: [] }).success, false);
    assert.equal(imagensAnaliseSchema.safeParse({ imagens: ["inválida"] }).success, false);
  });
});
