/** Pure configuration rules shared by build configuration and regression tests. */
export function chavePublica(anon?: string, publishable?: string) {
  return anon?.trim() || publishable?.trim() || undefined;
}

export function provedorFoto(geminiKey?: string) {
  return geminiKey?.trim() ? "gemini" : "lovable";
}