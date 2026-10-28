export type GeminiChunk = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
};

export function textoGemini(chunk: GeminiChunk) {
  if (chunk.promptFeedback?.blockReason) throw new Error("O Gemini não pôde analisar essa imagem por uma restrição de segurança.");
  const candidate = chunk.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error("O Gemini interrompeu a resposta. A análise não foi salva.");
  }
  return candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text ?? "").join("") ?? "";
}

export function imagemInline(imagem: string) {
  const match = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(imagem);
  if (!match?.[1] || !match[2]) throw new Error("Formato da foto inválido.");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}