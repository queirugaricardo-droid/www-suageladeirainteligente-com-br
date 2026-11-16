import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imagensAnaliseSchema } from "./plano";
import { chaveGemini } from "./deploy-config";
import { CATEGORIAS_DETECCAO, type CategoriaDeteccao } from "./fridge-types";

type ClienteSb = { from: (t: "analises_foto") => any; rpc: (...a: any[]) => any };

function extrairJson(texto: string) {
  const limpo = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("Não consegui interpretar a resposta da IA.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

function erroAmigavel(e: unknown) {
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes("402"))
    return "Os créditos de IA do app acabaram. Adicione créditos para continuar.";
  if (texto.includes("429"))
    return "Muitas análises seguidas. Espere alguns segundos e tente de novo.";
  if (texto.includes("403")) return "O uso de IA está bloqueado nas configurações do app.";
  return texto || "Não foi possível concluir a análise.";
}

export const analisarFoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => imagensAnaliseSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    try {
      const sb = context.supabase as unknown as ClienteSb;
      const messages = [
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: [
                "Você é um inspetor visual meticuloso de geladeiras abertas.",
                data.imagens.length > 1
                  ? `Você recebeu ${data.imagens.length} fotos da MESMA geladeira, de ângulos diferentes. Analise todas juntas e consolide os itens sem duplicar o mesmo alimento visto em mais ...[truncated]