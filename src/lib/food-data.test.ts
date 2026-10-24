import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { chaveDaConta, lerRelatorioSeguro, prepararRelatorioConfirmado } from "./food-data";
import { gerarRelatorio } from "./fridge-logic";

describe("dados confirmados e isolamento", () => {
  test("cada conta usa uma chave diferente do visitante e das demais contas", () => {
    assert.notEqual(chaveDaConta("geladeira:relatorio", "ana"), chaveDaConta("geladeira:relatorio", "bia"));
    assert.notEqual(chaveDaConta("geladeira:relatorio", "ana"), chaveDaConta("geladeira:relatorio", null));
    assert.equal(chaveDaConta("geladeira:estoque", null), "geladeira:estoque");
  });
  test("histórico preserva quantidades, confiança e estimativas confirmadas", () => {
    const report = gerarRelatorio([], [{ nome: "Leite", quantidade: 0.5, unidade: "L", confianca: 0.7, estimado: true }]);
    const payload = prepararRelatorioConfirmado(report);
    assert.deepEqual(payload.detectados[0], report.detectados?.[0]);
    assert.deepEqual(payload.linhas, []);
  });
  test("não aceita relatório sem alimentos confirmados", () => {
    assert.throws(() => prepararRelatorioConfirmado(gerarRelatorio([], [])));
  });
  test("quantidade negativa e confiança inválida não entram no histórico", () => {
    assert.throws(() => prepararRelatorioConfirmado(gerarRelatorio([], [{ nome: "Leite", quantidade: -1, unidade: "L" }])));
    assert.throws(() => prepararRelatorioConfirmado(gerarRelatorio([], [{ nome: "Leite", quantidade: 1, unidade: "L", confianca: 2 }])));
    assert.equal(lerRelatorioSeguro({ linhas: "inválido" }), null);
  });
});