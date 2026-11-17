type GeminiStatusError = {
  status?: unknown;
};

export function statusGemini(error: unknown): number | undefined {
  const status = (error as GeminiStatusError | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function permiteFallbackGemini(error: unknown): boolean {
  const status = statusGemini(error);
  // 429 can be a model-specific quota/rate limit; 503 means temporary overload.
  // Try the next configured image-capable model, but never mask auth/validation errors.
  return status === 429 || status === 503;
}

/** Retries one fresh image analysis after the SDK's own transient-error retries are exhausted. */
export async function comNovaTentativa503<T>(
  operacao: () => Promise<T>,
  aguardar: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (statusGemini(erro) !== 503) throw erro;
    await aguardar(1_000);
    return operacao();
  }
}

/**
 * Moves to the next configured Gemini model after a model-specific 429 quota/rate limit
 * or a temporary 503 overload. All other errors are returned immediately.
 */
export async function comFallbackModelos<T>(
  operacoes: Array<() => Promise<T>>,
  aguardar: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  if (operacoes.length === 0) {
    throw new Error("Nenhum modelo Gemini foi configurado para a análise.");
  }

  for (let indice = 0; indice < operacoes.length; indice += 1) {
    try {
      return await operacoes[indice]!();
    } catch (erro) {
      if (!permiteFallbackGemini(erro) || indice === operacoes.length - 1) {
        throw erro;
      }
      // A short pause is enough before changing models; don't repeatedly hammer a model at quota.
      await aguardar(statusGemini(erro) === 503 ? 1_000 : 250);
    }
  }

  throw new Error("Não foi possível concluir a análise com os modelos Gemini disponíveis.");
}
