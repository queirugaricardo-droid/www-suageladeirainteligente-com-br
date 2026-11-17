import { GoogleGenAI } from "@google/genai";
import { imagemInline, textoGemini, type GeminiChunk } from "./gemini-response";
import { comFallbackModelos, statusGemini } from "./gemini-retry";

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
  let modeloEmUso = model;

  try {
    const gerar = (modelo: string) => {
      modeloEmUso = modelo;
      return ai.models.generateContent({
        model: modelo,
        contents: [{ role: "user", parts: [{ text: prompt }, ...imagens.map(imagemInline)] }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: imagens.length ? itemSchema : priceSchema,
        },
      });
    };

    if (imagens.length > 0) {
      // Keep Gemini 3.5 Flash as primary. On model-specific quota/rate limits (429)
      // or temporary overload (503), try stable image-capable alternatives.
      const modelos = [...new Set([model, "gemini-3.6-flash", "gemini-3.5-flash-lite"])];
      response = await comFallbackModelos(
        modelos.map((modelo) => () => gerar(modelo)),
      );
      if (modeloEmUso !== model) {
        console.warn("Gemini utilizou modelo alternativo após limite/indisponibilidade", {
          modelSolicitado: model,
          modelUtilizado: modeloEmUso,
        });
      }
    } else {
      response = await gerar(model);
    }
  } catch (error) {
    // Log provider diagnostics on the server only; never expose response bodies to the browser.
    const status = statusGemini(error);
    const mensagem = error instanceof Error ? error.message : "Erro não identificado";
    console.error("Gemini generateContent falhou", {
      model: modeloEmUso,
      requestedModel: model,
      status: status ?? null,
      errorName: error instanceof Error ? error.name : "UnknownError",
      providerMessage: mensagem
        .replaceAll(chave, "[redigido]")
        .replace(/AIza[\w-]{20,}/g, "[redigido]")
        .replace(/data:image\/[\w+.-]+;base64,[A-Za-z0-9+/=]+/g, "[imagem redigida]")
        .slice(0, 500),
    });
    if (status === 401 || status === 403)
      throw new Error(
        "A chave Gemini não tem acesso autorizado. Confira a chave e as permissões na conta Google.",
      );
    if (status === 429)
      throw new Error(
        "A cota de uso do Gemini foi excedida nos modelos disponíveis. Confira os limites e o faturamento do projeto no Google AI Studio ou aguarde a renovação da cota.",
      );
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
