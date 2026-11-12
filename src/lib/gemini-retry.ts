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
