import { describe, expect, test } from "bun:test";
import { chaveDaConta, lerRelatorioSeguro, prepararRelatorioConfirmado } from "./food-data";
import { gerarRelatorio } from "./fridge-logic";

describe("dados confirmados e isolamento", () => {
  test("cada conta usa uma chave diferente do visitante e das demais contas", () => {
    expect(chaveDaConta("geladeira:relatorio", "ana")).not.toBe(chaveDaConta("geladeira:relatorio", "bia"));
    expect(chaveDaConta("geladeira:relatorio", "ana")).not.toBe(chaveDaConta("geladeira:relatorio", null));
    expect(chaveDaConta("geladeira:estoque", null)).toBe("geladeira:estoque");
  });
  test("histórico preserva quantidades, confiança e estimativas confirmadas", () => {
    const report = gerarRelatorio([], [{ nome: "Leite", quantidade: 0.5, unidade: "L", confianca: 0.7, estimado: true }]);
    const payload = prepararRelatorioConfirmado(report);
    expect(payload.detectados[0]).toEqual(report.detectados?.[0]);
    expect(payload.linhas).toEqual([]);
  });
  test("não aceita relatório sem alimentos confirmados", () => {
    expect(() => prepararRelatorioConfirmado(gerarRelatorio([], []))).toThrow();
  });
  test("quantidade negativa e confiança inválida não entram no histórico", () => {
    expect(() => prepararRelatorioConfirmado(gerarRelatorio([], [{ nome: "Leite", quantidade: -1, unidade: "L" }]))).toThrow();
    expect(() => prepararRelatorioConfirmado(gerarRelatorio([], [{ nome: "Leite", quantidade: 1, unidade: "L", confianca: 2 }]))).toThrow();
    expect(lerRelatorioSeguro({ linhas: "inválido" })).toBeNull();
  });
});