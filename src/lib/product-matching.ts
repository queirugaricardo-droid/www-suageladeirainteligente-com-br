const IGNORAR = new Set([
  "a", "as", "ao", "aos", "com", "da", "das", "de", "do", "dos", "e", "em",
  "kg", "g", "mg", "l", "ml", "un", "unidade", "unidades", "pacote", "pacotes",
  "mercado", "supermercado", "loja", "marca", "tipo", "tamanho",
]);

// Termos que indicam que o resultado é uma preparação/derivado, não o alimento simples.
// Só bloqueiam quando não fazem parte da própria consulta.
const TERMOS_DE_OUTRA_CATEGORIA = new Set([
  "molho", "sauce", "suco", "juice", "iogurte", "yogurt", "bebida", "drink",
  "muffin", "bolo", "cake", "torta", "pizza", "strogonoff", "lasanha", "sopa",
  "caldo", "creme", "cream", "sabor", "flavored", "recheio", "barra", "barrinha",
  "cereal", "mix", "mistura", "farinha", "chips", "snack", "biscoito", "cookie",
  "doce", "geleia", "compota", "conserva", "extrato", "ketchup", "mostarda",
  "marmita", "prato", "refeicao", "muffins", "pepper", "rings", "chip", "ring",
  "condensado", "achocolatado", "chocolate", "pao", "paozinho", "sorvete", "sorbet",
  "passa", "desidratado", "desidratada", "enlatado", "enlatada", "empanado", "empanada",
  "nectar", "pure", "puree", "smoothie", "milkshake", "salada", "po",
  // Outro alimento principal no nome costuma indicar mistura/sabor, não o item simples.
  "morango", "strawberry", "maca", "apple", "laranja", "orange", "uva", "grape",
  "manga", "mango", "abacaxi", "pineapple", "pessego", "peach", "pera", "pear",
  "framboesa", "raspberry", "mirtilo", "blueberry", "cereja", "cherry", "kiwi",
  "melancia", "watermelon", "limao", "lemon", "lima", "lime", "mamao", "papaya",
  "goiaba", "guava", "maracuja", "passion", "acerola", "coco", "coconut",
]);

function normalizarTokens(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !IGNORAR.has(token))
    .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token));
}

/**
 * Retorna 1 somente quando todos os termos relevantes da consulta estão no produto
 * e não há sinal explícito de que o resultado é outra categoria/preparação.
 * Retorna 0 para correspondência parcial ou ambígua: preço não deve ser exibido.
 */
export function scoreProductName(consulta: string, nomeProduto: string) {
  const procurados = normalizarTokens(consulta);
  const encontrados = new Set(normalizarTokens(nomeProduto));
  if (procurados.length === 0 || encontrados.size === 0) return 0;

  const todosOsTermosPresentes = procurados.every((token) => encontrados.has(token));
  if (!todosOsTermosPresentes) return 0;

  const termosDaConsulta = new Set(procurados);
  const temOutraCategoria = [...encontrados].some(
    (token) => TERMOS_DE_OUTRA_CATEGORIA.has(token) && !termosDaConsulta.has(token),
  );
  if (temOutraCategoria) return 0;

  return 1;
}
