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
};

export type ItemDetectado = {
  nome: string;
  quantidade: number;
  unidade: string;
  confianca?: number | undefined;
};

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
