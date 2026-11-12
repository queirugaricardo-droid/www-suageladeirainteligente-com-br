import { GoogleGenAI } from "@google/genai";
import { imagemInline, textoGemini, type GeminiChunk } from "./gemini-response";
import { comNovaTentativa503, statusGemini } from "./gemini-retry";

const itemSchema = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          quantidade: { type: "number" },
          unidade: { type: "string", enum: ["un", "kg", "g", "L", "ml", "pacote"] },
          estimado: { type: "boolean" },
          confianca: { type: "number" },
          emoji: { type: "string" },
          categoria: {
            type: "string",
            enum: [
              "Frutas",
              "Verduras e legumes",
              "Laticínios",
              "Bebidas",
              "Carnes",
              "Ovos",
              "Outros",
            ],
          },
        },
        required: ["nome", "quantidade", "unidade", "estimado", "confianca", "emoji", "categoria"],
      },
    },
  },
  required: ["itens"],
};

const priceSchema = {
  type: "object",
  properties: {
    precos: {
      type: "array",
      items: {
        type: "object",
        properties: { nome: { type: "string" }, precoUnitario: { type: "number" } },
        required: ["nome", "precoUnitario"],
      },
    },
    observacao: { type: "string" },
  },
  required: ["precos", "observacao"],
};

/** Credentials are passed only from a server-function handler. Never switch providers on failure. */
export async function gerarJsonGemini(
  chave: string,
  prompt: string,
  imagens: string[] = [],
  model = "gemini-3.5-flash",
) {
  const ai = new GoogleGenAI({
    apiKey: chave,
    // The SDK does not retry unless this is configured. Keep the retry window
    // bounded for serverless execution while tolerating brief Gemini 5xx overloads.
    httpOptions: {
      retryOptions: {
        attempts: 3,
        initialDelay: 0.75,
        maxDelay: 3,
        expBase: 2,
        jitter: 0.5,
      },
    },
  });
  let response;
  try {
    const gerar = () =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }, ...imagens.map(imagemInline)] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: imagens.length ? itemSchema : priceSchema,
        },
      });
    // A single fresh photo request helps if the provider remains overloaded
    // after the bounded retries configured above.
    response = imagens.length ? await comNovaTentativa503(gerar) : await gerar();
  } catch (error) {
    // Log provider diagnostics on the server only; never expose response bodies to the browser.
    const status = statusGemini(error);
    const mensagem = error instanceof Error ? error.message : "Erro não identificado";
    console.error("Gemini generateContent falhou", {
      model,
      status: status ?? null,
      errorName: error instanceof Error ? error.name : "UnknownError",
      providerMessage: mensagem
        .replaceAll(chave, "[redigido]")
        .replace(/AIza[\w-]{20,}/g, "[redigido]")
        .replace(/data:image\/[\w+.-]+;base64,[A-Za-z0-9+/=]+/g, "[imagem redigida]")
        .slice(0, 300),
    });
    if (status === 401 || status === 403)
      throw new Error(
        "A chave Gemini não tem acesso autorizado. Confira a chave e as permissões na conta Google.",
      );
    if (status === 429)
      throw new Error("O limite de uso do Gemini foi atingido. Confira a cota na conta Google.");
    if (status === 503)
      throw new Error(
        "O Gemini permaneceu indisponível após as tentativas automáticas. Tente novamente em instantes.",
      );
    throw new Error(
      `Não foi possível concluir a análise com Gemini${status ? ` (${status})` : ""}.`,
    );
  }
  const text = textoGemini(response as GeminiChunk);
  if (!text.trim()) throw new Error("O Gemini não retornou alimentos reconhecíveis.");
  return text;
}
