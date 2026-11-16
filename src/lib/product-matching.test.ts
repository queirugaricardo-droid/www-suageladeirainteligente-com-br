import assert from "node:assert/strict";
import test from "node:test";
import { scoreProductName } from "./product-matching";

test("aceita o mesmo alimento com marca, embalagem e descritores", () => {
  assert.equal(scoreProductName("leite integral", "Leite Integral UHT Italac 1L"), 1);
  assert.equal(scoreProductName("arroz branco", "Arroz Branco Tipo 1 5kg"), 1);
  assert.equal(scoreProductName("feijão carioca", "Feijão Carioca Tipo 1 1kg"), 1);
  assert.equal(scoreProductName("banana", "Banana Nanica"), 1);
  assert.equal(scoreProductName("tomate", "Tomate Italiano"), 1);
});

test("rejeita produtos que apenas mencionam o alimento procurado", () => {
  assert.equal(scoreProductName("banana", "Banana Sauce Hot and Spicy"), 0);
  assert.equal(scoreProductName("ovos", "BALA FINI OVOS FRITOS 90G"), 0);
  assert.equal(scoreProductName("ovos", "Macarrão de Sêmola com Ovos Caseiro Talharim 500g"), 0);
  assert.equal(scoreProductName("ovos", "Ovos brancos 12 unidades"), 1);
  assert.equal(scoreProductName("banana", "Strawberry and Banana Nectar"), 0);
  assert.equal(scoreProductName("banana", "Stonyfield Organic Real Fruit Strawberry Banana"), 0);
  assert.equal(scoreProductName("banana", "Strawberry Banana Low Fat Yogurt"), 0);
  assert.equal(scoreProductName("banana", "Banana Nut Muffin Mix"), 0);
  assert.equal(scoreProductName("banana", "Mild Banana Pepper Rings"), 0);
  assert.equal(scoreProductName("banana", "Organic Banana Chips"), 0);
  assert.equal(scoreProductName("arroz branco", "Strogonoff de Peru com Arroz Branco"), 0);
  assert.equal(scoreProductName("tomate", "Extrato de Tomate"), 0);
  assert.equal(scoreProductName("feijão carioca", "Caldo de Feijão Carioca"), 0);
  assert.equal(scoreProductName("leite integral", "Leite Condensado Integral"), 0);
});

test("rejeita correspondência parcial e consulta vazia", () => {
  assert.equal(scoreProductName("leite integral", "Leite em Pó"), 0);
  assert.equal(scoreProductName("arroz branco", "Arroz Integral"), 0);
  assert.equal(scoreProductName("   ", "Banana Nanica"), 0);
});
