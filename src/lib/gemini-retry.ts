type GeminiStatusError = {
  status?: unknown;
};

export function statusGemini(error: unknown): number | undefined {
  const status = (error as GeminiStatusError | null)?.status;
  return typeof status === "number" ? status : undefined;
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
 * Moves to the next supported Gemini model only when the current model returns 503.
 * Authentication, quota, validation, and other errors are returned immediately.
 */
export async function comFallbackModelos503<T>(
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
      if (statusGemini(erro) !== 503 || indice === operacoes.length - 1) {
        throw erro;
      }
      await aguardar(1_000);
    }
  }

  throw new Error("Não foi possível concluir a análise com os modelos Gemini disponíveis.");
}
