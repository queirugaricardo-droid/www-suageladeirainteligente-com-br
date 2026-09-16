import type {
  Categoria,
  ItemDetectado,
  ItemIdeal,
  LinhaRelatorio,
  Relatorio,
} from "./fridge-types";

export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function singular(palavra: string) {
  if (palavra.endsWith("oes")) return palavra.slice(0, -3) + "ao";
  if (palavra.endsWith("aes")) return palavra.slice(0, -3) + "ao";
  if (palavra.endsWith("ns")) return palavra.slice(0, -2) + "m";
  if (palavra.endsWith("es") && palavra.length > 4) return palavra.slice(0, -2);
  if (palavra.endsWith("s") && palavra.length > 3) return palavra.slice(0, -1);
  return palavra;
}

function tokens(texto: string) {
  const ignorar = new Set(["de", "da", "do", "com", "sem", "e", "em", "a", "o"]);
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length > 1 && !ignorar.has(p))
    .map(singular);
}

export function mesmoItem(a: string, b: string) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const na = ta.join(" ");
  const nb = tb.join(" ");
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const comuns = ta.filter((t) => tb.some((o) => o === t || o.includes(t) || t.includes(o)));
  return comuns.length >= Math.min(ta.length, tb.length);
}

const FATORES: Record<string, number> = { g: 0.001, kg: 1, ml: 0.001, l: 1, un: 1, pacote: 1 };

function converter(quantidade: number, de: string, para: string) {
  const d = normalizar(de) || "un";
  const p = normalizar(para) || "un";
  if (d === p) return quantidade;
  const fd = FATORES[d];
  const fp = FATORES[p];
  if (!fd || !fp) return quantidade;
  return (quantidade * fd) / fp;
}

export function gerarRelatorio(ideal: ItemIdeal[], detectado: ItemDetectado[]): Relatorio {
  const usados = new Set<number>();

  const linhas: LinhaRelatorio[] = ideal.map((item) => {
    let total = 0;
    detectado.forEach((d, i) => {
      if (mesmoItem(item.nome, d.nome)) {
        usados.add(i);
        total += converter(d.quantidade || 0, d.unidade, item.unidade);
      }
    });
    const percentual = item.quantidade > 0 ? Math.min(1, total / item.quantidade) : 1;
    const faltam = Math.max(0, item.quantidade - total);
    const situacao: LinhaRelatorio["situacao"] =
      percentual >= 0.99 ? "ok" : percentual <= 0.15 ? "faltando" : "baixo";
    return {
      item,
      detectado: Math.round(total * 100) / 100,
      percentual,
      situacao,
      faltam: Math.round(faltam * 100) / 100,
    };
  });

  const extras = detectado.filter((_, i) => !usados.has(i));
  const abastecimento = linhas.length
    ? linhas.reduce((soma, l) => soma + l.percentual, 0) / linhas.length
    : 0;

  return {
    criadoEm: Date.now(),
    linhas,
    extras,
    abastecimento: Math.round(abastecimento * 100),
  };
}

export function categoriaPalpite(nome: string): Categoria {
  const n = normalizar(nome);
  const mapa: Array<[Categoria, string[]]> = [
    ["Hortifrúti", ["alface", "tomate", "cenoura", "maca", "banana", "laranja", "limao", "cebola", "batata", "uva", "morango", "brocolis", "pepino"]],
    ["Laticínios", ["leite", "queijo", "iogurte", "manteiga", "requeijao", "creme", "ovo"]],
    ["Carnes", ["frango", "carne", "peixe", "linguica", "bacon", "presunto", "file"]],
    ["Bebidas", ["suco", "refrigerante", "agua", "cerveja", "cha", "vinho"]],
    ["Condimentos", ["ketchup", "mostarda", "maionese", "molho", "azeite", "geleia"]],
    ["Congelados", ["congelado", "sorvete", "pizza", "nugget"]],
  ];
  for (const [categoria, palavras] of mapa) {
    if (palavras.some((p) => n.includes(p))) return categoria;
  }
  return "Outros";
}

export const ESTOQUE_EXEMPLO: ItemIdeal[] = [
  { id: "1", nome: "Leite", quantidade: 2, unidade: "L", categoria: "Laticínios" },
  { id: "2", nome: "Ovos", quantidade: 12, unidade: "un", categoria: "Laticínios" },
  { id: "3", nome: "Tomate", quantidade: 6, unidade: "un", categoria: "Hortifrúti" },
  { id: "4", nome: "Alface", quantidade: 1, unidade: "un", categoria: "Hortifrúti" },
  { id: "5", nome: "Peito de frango", quantidade: 1, unidade: "kg", categoria: "Carnes" },
  { id: "6", nome: "Queijo mussarela", quantidade: 300, unidade: "g", categoria: "Laticínios" },
  { id: "7", nome: "Suco de laranja", quantidade: 2, unidade: "L", categoria: "Bebidas" },
  { id: "8", nome: "Manteiga", quantidade: 1, unidade: "un", categoria: "Laticínios" },
];
