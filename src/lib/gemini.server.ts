import { GoogleGenAI, Type } from "@google/genai";
import { imagemInline } from "./gemini-response";

const itemSchema = {
  type: Type.OBJECT,
  properties: {
    itens: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          quantidade: { type: Type.NUMBER },
          unidade: { type: Type.STRING, enum: ["un", "kg", "g", "L", "ml", "pacote"] },
          estimado: { type: Type.BOOLEAN },
          confianca: { type: Type.NUMBER },
          emoji: { type: Type.STRING },
          categoria: {
            type: Type.STRING,
            enum: ["Frutas", "Verduras e legumes", "Laticínios", "Bebidas", "Carnes", "Ovos", "Outros"],
          },
          observacao: { type: Type.STRING },
        },
        required: ["nome", "quantidade", "unidade", "estimado", "confianca", "emoji", "categoria", "observacao"],
      },
    },
  },
  required: ["itens"],
};

const priceSchema = {
  type: Type.OBJECT,
  properties: {
    precos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { nome: { type: Type.STRING }, precoUnitario: { type: Type.NUMBER } },
        required: ["nome", "precoUnitario"],
      },
    },
    observacao: { type: Type.STRING },
  },
  required: ["precos", "observacao"],
};

/** Mensagens seguras para o usuário; nunca expõe corpo da resposta nem a chave. */
export function erroGemini(e: unknown): Error {
  const texto = e instanceof Error ? e.message : String(e);
  if (/401|403|API key not valid|PERMISSION_DENIED|unauthorized/i.test(texto)) {
    return new Error("A chave Gemini não tem acesso autorizado. Confira a chave e as permissões na conta Google.");
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(texto)) {
    return new Error("O limite de uso do Gemini foi atingido. Aguarde um pouco ou confira a cota na conta Google.");
  }
  if (/SAFETY|blockReason|blocked/i.test(texto)) {
    return new Error("O Gemini não pôde analisar essa imagem por uma restrição de segurança.");
  }
  return e instanceof Error ? e : new Error("Não foi possível concluir a análise com Gemini.");
}

/** Credentials are passed only from a server-function handler. Never retry or switch on failure. */
export async function gerarJsonGemini(chave: string, prompt: string, imagens: string[] = [], model = "gemini-2.5-flash") {
  const ai = new GoogleGenAI({ apiKey: chave });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, ...imagens.map(imagemInline)] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: imagens.length ? itemSchema : priceSchema,
      },
    });
    const text = response.text ?? "";
    if (!text.trim()) throw new Error("O Gemini não retornou alimentos reconhecíveis.");
    return text;
  } catch (e) {
    throw erroGemini(e);
  }
}
