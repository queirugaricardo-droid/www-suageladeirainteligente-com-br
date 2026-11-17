import assert from "node:assert/strict";
import test from "node:test";
import { calcularMediaPrecos } from "./market-price-average";

test("calcula a média dos preços encontrados", () => {
  assert.equal(calcularMediaPrecos([5.5, 6, 5.8]), 5.77);
});

test("ignora preços ausentes, zero, negativos e inválidos", () => {
  assert.equal(calcularMediaPrecos([5.5, 0, -2, Number.NaN, Number.POSITIVE_INFINITY]), 5.5);
});

test("retorna zero quando nenhum mercado fornece preço", () => {
  assert.equal(calcularMediaPrecos([0, Number.NaN]), 0);
});
