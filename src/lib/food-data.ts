import { z } from "zod";
import type { Relatorio } from "./fridge-types";

const item = z.object({ nome: z.string().trim().min(1).max(120), quantidade: z.number().finite().nonnegative(), unidade: z.string().min(1), confianca: z.number().min(0).max(1).optional(), estimado: z.boolean().optional(), emoji: z.string().optional(), categoria: z.string().optional() }).passthrough();
const report = z.object({ criadoEm: z.number().finite(), linhas: z.array(z.object({ item: z.object({ id: z.string(), nome: z.string(), quantidade: z.number(), unidade: z.string(), categoria: z.string() }).passthrough(), detectado: z.number(), percentual: z.number(), situacao: z.enum(["ok", "baixo", "faltando"]), faltam: z.number() })), extras: z.array(item), abastecimento: z.number().min(0).max(100), detectados: z.array(item).optional() });

export function lerRelatorioSeguro(value: unknown): Relatorio | null {
  const result = report.safeParse(value);
  return result.success ? result.data as Relatorio : null;
}

export function chaveDaConta(base: string, userId: string | null) {
  return userId ? `${base}:conta:${userId}` : base;
}

export function prepararRelatorioConfirmado(value: Relatorio) {
  const result = lerRelatorioSeguro(value);
  if (!result?.detectados?.length || result.detectados.length > 200) throw new Error("Confirme entre 1 e 200 alimentos válidos.");
  return JSON.parse(JSON.stringify(result));
}