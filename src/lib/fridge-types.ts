export const CATEGORIAS = [
  "Hortifrúti",
  "Laticínios",
  "Carnes",
  "Bebidas",
  "Condimentos",
  "Congelados",
  "Outros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const UNIDADES = ["un", "kg", "g", "L", "ml", "pacote"] as const;
export type Unidade = (typeof UNIDADES)[number];

export type ItemIdeal = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: Unidade;
  categoria: Categoria;
  emoji?: string | undefined;
};

export type ItemDetectado = {
  nome: string;
  quantidade: number;
  unidade: string;
  confianca?: number | undefined;
  emoji?: string | undefined;
  categoria?: CategoriaDeteccao | undefined;
};

export const CATEGORIAS_DETECCAO = [
  "Frutas",
  "Verduras e legumes",
  "Laticínios",
  "Bebidas",
  "Carnes",
  "Ovos",
  "Outros",
] as const;

export type CategoriaDeteccao = (typeof CATEGORIAS_DETECCAO)[number];

export type LinhaRelatorio = {
  item: ItemIdeal;
  detectado: number;
  percentual: number;
  situacao: "ok" | "baixo" | "faltando";
  faltam: number;
};

export type Relatorio = {
  criadoEm: number;
  linhas: LinhaRelatorio[];
  extras: ItemDetectado[];
  abastecimento: number;
  detectados?: ItemDetectado[] | undefined;
};

export type Loja = {
  nome: string;
  endereco: string;
  distanciaKm?: number | undefined;
  nota?: number | undefined;
};

export type PrecoEstimado = {
  nome: string;
  precoUnitario: number;
};
