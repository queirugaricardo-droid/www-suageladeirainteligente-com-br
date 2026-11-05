import { GoogleGenAI } from "@google/genai";
import { imagemInline, textoGemini, type GeminiChunk } from "./gemini-response";

const itemSchema = {
  type: "object",
  properties: {
    itens: { type: "array", items: {
      type: "object",
      properties: {
        nome: { type: "string" }, quantidade: { type: "number" },
        unidade: { type: "string", enum: ["un", "kg", "g", "L", "ml", "pacote"] },
        estimado: { type: "boolean" }, confianca: { type: "number" },
        emoji: { type: "string" }, categoria: { type: "string", enum: ["Frutas", "Verduras e legumes", "Laticínios", "Bebidas", "Carnes", "Ovos", "Outros"] },
      }, required: ["nome", "quantidade", "unidade", "estimado", "confianca", "emoji", "categoria"],
    } },
  }, required: ["itens"],
};

const priceSchema = {
  type: "object", properties: {
    precos: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, precoUnitario: { type: "number" } }, required: ["nome", "precoUnitario"] } },
    observacao: { type: "string" },
  }, required: ["precos", "observacao"],
};

/** Credentials are passed only from a server-function handler. Never retry or switch on failure. */
export async function gerarJsonGemini(chave: string, prompt: string, imagens: string[] = [], model = "gemini-2.5-flash") {
  const ai = new GoogleGenAI({ apiKey: chave });
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, ...imagens.map(imagemInline)] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: imagens.length ? itemSchema : priceSchema,
      },
    });
  } catch (error) {
    // Never expose error bodies which can contain request metadata or credentials.
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) throw new Error("A chave Gemini não tem acesso autorizado. Confira a chave e as permissões na conta Google.");
    if (status === 429) throw new Error("O limite de uso do Gemini foi atingido. Confira a cota na conta Google.");
    throw new Error(`Não foi possível concluir a análise com Gemini${status ? ` (${status})` : ""}.`);
  }
  const text = textoGemini(response as GeminiChunk);
  if (!text.trim()) throw new Error("O Gemini não retornou alimentos reconhecíveis.");
  return text;
}
