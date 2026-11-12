type InputItem = { nome: string; quantidade: number; unidade: string };
type Coordinates = { lat: number; lng: number };

type SearchProduct = {
  ean?: string;
  product_name?: string;
};

type ProductResponse = {
  product?: {
    normalized_value?: number;
    normalized_unit?: string;
    units_per_pack?: number;
  };
  prices?: Array<{
    store_name?: string;
    store_coords?: string;
    price?: number;
    promo_price?: number | null;
    update_date?: string;
    city_name?: string;
  }>;
};

const BASE_URL = "https://www.precomelhor.com.br/api";
const STOP_WORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "kg",
  "l",
  "ml",
  "g",
  "un",
  "unidade",
  "mercado",
  "supermercado",
  "loja",
  "express",
]);

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(texto: string) {
  return normalizar(texto)
    .split(/\s+/)
    .filter((parte) => parte.length > 1 && !STOP_WORDS.has(parte));
}

function similaridadeProduto(consulta: string, produto: string) {
  const procurados = tokens(consulta);
  if (procurados.length === 0) return 0;
  const encontrados = new Set(tokens(produto));
  return procurados.filter((token) => encontrados.has(token)).length / procurados.length;
}

function distanciaKm(origem: Coordinates, destino: Coordinates) {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(destino.lat - origem.lat);
  const dLng = rad(destino.lng - origem.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(origem.lat)) * Math.cos(rad(destino.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function coordenadasDaLoja(value?: string): Coordinates | undefined {
  if (!value) return undefined;
  const partes = value.split(",");
  const lat = Number(partes[0]);
  const lng = Number(partes[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
}

function unidadeBase(unidade: string): { tipo: string; fator: number } | undefined {
  const u = normalizar(unidade).replace(/s$/, "");
  if (["g", "grama", "gramas"].includes(u)) return { tipo: "massa", fator: 1 };
  if (["kg", "quilo", "quilo grama", "quilograma"].includes(u))
    return { tipo: "massa", fator: 1000 };
  if (["ml", "mililitro"].includes(u)) return { tipo: "volume", fator: 1 };
  if (["l", "litro"].includes(u)) return { tipo: "volume", fator: 1000 };
  if (["un", "unidade", "unidade(s)", "unid"].includes(u)) return { tipo: "contagem", fator: 1 };
  return undefined;
}

function media(valores: number[]) {
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url, {
    headers: {
      "User-Agent": "SuaGeladeiraInteligente/1.0 (+https://suageladeirainteligente.com.br)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resposta.ok) throw new Error(`Fonte de preços indisponível (${resposta.status}).`);
  return (await resposta.json()) as T;
}

function mediaUnidade(
  precoOferta: number,
  quantidade: number,
  unidade: string,
  tamanhoPacote?: number,
  unidadePacote?: string,
  unidadesNoPacote?: number,
) {
  const desejada = unidadeBase(unidade);
  const pacote = unidadeBase(unidadePacote ?? "");
  const escala =
    desejada && pacote && desejada.tipo === pacote.tipo ? desejada.fator / pacote.fator : undefined;
  if (!escala || !tamanhoPacote || tamanhoPacote <= 0) return precoOferta;
  const tamanhoBase =
    tamanhoPacote * (unidadesNoPacote && unidadesNoPacote > 1 ? unidadesNoPacote : 1);
  return (precoOferta / tamanhoBase) * (quantidade * escala);
}

function ofertaDaLoja(
  ofertas: NonNullable<ProductResponse["prices"]>,
  mercado?: string,
  coordenadas?: Coordinates,
  local?: string,
) {
  let disponiveis = ofertas.filter((oferta) => {
    const preco = oferta.promo_price ?? oferta.price;
    return Number.isFinite(preco) && (preco ?? 0) > 0;
  });

  if (mercado?.trim()) {
    const rede = tokens(mercado);
    disponiveis = disponiveis.filter((oferta) => {
      const nomeLoja = new Set(tokens(oferta.store_name ?? ""));
      const comuns = rede.filter((token) => nomeLoja.has(token)).length;
      return comuns > 0 && comuns / Math.max(1, Math.min(rede.length, nomeLoja.size)) >= 0.5;
    });
  }

  if (coordenadas) {
    disponiveis = disponiveis.filter((oferta) => {
      const ponto = coordenadasDaLoja(oferta.store_coords);
      return !!ponto && distanciaKm(coordenadas, ponto) <= 5;
    });
  } else if (local?.trim()) {
    const cidade = normalizar(local.split(",")[0] ?? "");
    if (cidade.length > 2) {
      disponiveis = disponiveis.filter((oferta) =>
        normalizar(oferta.city_name ?? "").includes(cidade),
      );
    }
  }
  return disponiveis;
}

export async function consultarPrecosObservados(
  itens: InputItem[],
  filtros: { mercado?: string; local?: string; coordenadas?: Coordinates },
) {
  if (itens.length > 20)
    throw new Error("Consulte até 20 itens por vez para respeitar a cota da fonte de preços.");

  const resultados = await Promise.all(
    itens.map(async (item) => {
      try {
        const busca = await buscarJson<{ items?: SearchProduct[] }>(
          `${BASE_URL}/search?q=${encodeURIComponent(item.nome)}`,
        );
        const produto = (busca.items ?? [])
          .filter(
            (candidate): candidate is SearchProduct & { ean: string; product_name: string } =>
              !!candidate.ean && !!candidate.product_name,
          )
          .map((candidate) => ({
            ...candidate,
            score: similaridadeProduto(item.nome, candidate.product_name),
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (!produto || produto.score < 0.25) {
          return { nome: item.nome, precoUnitario: 0, produto: "", mercado: "", atualizadoEm: "" };
        }

        const dados = await buscarJson<ProductResponse>(
          `${BASE_URL}/product/${encodeURIComponent(produto.ean)}`,
        );
        const ofertas = ofertaDaLoja(
          dados.prices ?? [],
          filtros.mercado,
          filtros.coordenadas,
          filtros.local,
        );
        const valores = ofertas
          .map((oferta) => Number(oferta.promo_price ?? oferta.price))
          .filter((preco) => Number.isFinite(preco) && preco > 0);
        if (valores.length === 0) {
          return {
            nome: item.nome,
            precoUnitario: 0,
            produto: produto.product_name,
            mercado: "",
            atualizadoEm: "",
          };
        }

        const precoPacote = media(valores);
        const preco = mediaUnidade(
          precoPacote,
          item.quantidade,
          item.unidade,
          dados.product?.normalized_value,
          dados.product?.normalized_unit,
          dados.product?.units_per_pack,
        );
        const datas = ofertas
          .map((oferta) => oferta.update_date ?? "")
          .filter(Boolean)
          .sort();
        const nomeLoja = filtros.mercado?.trim()
          ? (ofertas[0]?.store_name ?? filtros.mercado)
          : filtros.coordenadas
            ? "mercados próximos"
            : "ofertas online monitoradas";

        return {
          nome: item.nome,
          precoUnitario: Math.round(preco * 100) / 100,
          produto: produto.product_name,
          mercado: nomeLoja,
          atualizadoEm: datas.at(-1) ?? "",
        };
      } catch {
        return { nome: item.nome, precoUnitario: 0, produto: "", mercado: "", atualizadoEm: "" };
      }
    }),
  );

  const semPreco = resultados.filter((resultado) => resultado.precoUnitario <= 0).length;
  const dataMaisRecente = resultados
    .map((resultado) => resultado.atualizadoEm)
    .filter(Boolean)
    .sort()
    .at(-1);
  const escopo = filtros.mercado
    ? `ofertas encontradas para ${filtros.mercado}`
    : filtros.coordenadas
      ? "ofertas com lojas cadastradas em até 5 km"
      : filtros.local
        ? `ofertas associadas a ${filtros.local}`
        : "média das ofertas online monitoradas no Brasil";
  const observacao = [
    `Valores observados em ${escopo}; a base pode não cobrir todos os mercados ou produtos.`,
    dataMaisRecente ? `Coleta mais recente entre os itens: ${dataMaisRecente.slice(0, 10)}.` : "",
    semPreco ? `${semPreco} item(ns) sem preço compatível nesta consulta.` : "",
    "Preços online podem diferir dos praticados na filial física.",
  ]
    .filter(Boolean)
    .join(" ");

  return { precos: resultados, observacao, dataColeta: dataMaisRecente ?? "" };
}
