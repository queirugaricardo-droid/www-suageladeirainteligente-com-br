/** Calcula a média somente de preços observados positivos e finitos. */
export function calcularMediaPrecos(valores: number[]): number {
  const validos = valores.filter((valor) => Number.isFinite(valor) && valor > 0);
  if (validos.length === 0) return 0;
  return Math.round((validos.reduce((total, valor) => total + valor, 0) / validos.length) * 100) / 100;
}
