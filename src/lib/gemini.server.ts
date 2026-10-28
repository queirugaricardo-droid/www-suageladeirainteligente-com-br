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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "x-goog-api-key": chave, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, ...imagens.map(imagemInline)] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: imagens.length ? itemSchema : priceSchema },
    }),
  });
  if (!response.ok) {
    // Never expose response bodies which can contain request metadata or credentials.
    if (response.status === 401 || response.status === 403) throw new Error("A chave Gemini não tem acesso autorizado. Confira a chave e as permissões na conta Google.");
    if (response.status === 429) throw new Error("O limite de uso do Gemini foi atingido. Confira a cota na conta Google.");
    throw new Error(`Não foi possível concluir a análise com Gemini (${response.status}).`);
  }
  if (!response.body) throw new Error("O Gemini não enviou uma resposta.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const processLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data && data !== "[DONE]") text += textoGemini(JSON.parse(data) as GeminiChunk);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(processLine);
      if (done) { processLine(buffer); break; }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  if (!text.trim()) throw new Error("O Gemini não retornou alimentos reconhecíveis.");
  return text;
}