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

type CepResponse = {
  localidade?: string;
  uf?: string;
  erro?: boolean;
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

const RAIO_MAXIMO_FILIAL_KM = 0.35;

function correspondeFilialSelecionada(
  nomeSelecionado: string,
  coordenadasSelecionadas: Coordinates | undefined,
  nomeEncontrado: string,
  coordenadasEncontradas?: Coordinates,
  nomesAlternativos: Array<string | null | undefined> = [],
) {
  if (!nomeSelecionado.trim()) return false;

  // Quando as duas lojas têm coordenadas, a distância é o critério principal.
  // Exige também algum nome em comum para evitar cruzar lojas diferentes próximas.
  if (coordenadasSelecionadas && coordenadasEncontradas) {
    const tokensEncontrados = new Set(tokens(nomeEncontrado));
    const temIdentificadorComum = tokens(nomeSelecionado).some((token) =>
      tokensEncontrados.has(token),
    );
    return (
      temIdentificadorComum &&
      distanciaKm(coordenadasSelecionadas, coordenadasEncontradas) <= RAIO_MAXIMO_FILIAL_KM
    );
  }

  // Sem coordenadas confiáveis, só aceita igualdade integral do nome da filial.
  const nomeNormalizado = normalizar(nomeSelecionado);
  return [nomeEncontrado, ...nomesAlternativos].some(
    (nome) => !!nome && normalizar(nome) === nomeNormalizado,
  );
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

async function resolverLocalidade(local?: string) {
  const cep = local?.replace(/\D/g, "") ?? "";
  if (cep.length !== 8) return local;

  try {
    const endereco = await buscarJson<CepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
    if (endereco.erro || !endereco.localidade) return local;
    return [endereco.localidade, endereco.uf].filter(Boolean).join(", ");
  } catch {
    // Preserve the user's input if ViaCEP is unavailable; the search will not crash.
    return local;
  }
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
  if (!escala || !tamanhoPacote || tamanhoPacote <= 0)
    return desejada?.tipo === "contagem" || normalizar(unidade) === "pacote"
      ? precoOferta * quantidade
      : precoOferta;
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
    // Uma rede não identifica uma filial: exige coordenadas próximas ou nome completo idêntico.
    disponiveis = disponiveis.filter((oferta) =>
      correspondeFilialSelecionada(
        mercado,
        coordenadas,
        oferta.store_name ?? "",
        coordenadasDaLoja(oferta.store_coords),
      ),
    );
  } else if (coordenadas) {
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

type OpenPricesProduct = {
  code?: string;
  product_name?: string;
  product_quantity?: number | null;
  product_quantity_unit?: string | null;
  price_count?: number;
};

type OpenPricesLocation = {
  osm_name?: string | null;
  osm_display_name?: string | null;
  osm_brand?: string | null;
  osm_address_city?: string | null;
  osm_lat?: string | number | null;
  osm_lon?: string | number | null;
};

type OpenPricesRecord = {
  price?: number | string | null;
  currency?: string | null;
  date?: string | null;
  created?: string | null;
  price_per?: string | null;
  duplicate_of?: number | null;
  product_code?: string | null;
  product_name?: string | null;
  product?: OpenPricesProduct | null;
  location?: OpenPricesLocation | null;
};

type OpenPricesPage = { items?: OpenPricesRecord[] };

const OPEN_PRICES_URL = "https://prices.openfoodfacts.org/api/v1";

async function buscarOpenPricesJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SuaGeladeiraInteligente/1.0 (https://suageladeirainteligente.com.br)",
    },
    signal: AbortSignal.timeout(9_000),
  });
  if (!resposta.ok) throw new Error(`Open Prices indisponível (${resposta.status}).`);
  return (await resposta.json()) as T;
}

function mediana(valores: number[]) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]!
    : ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2;
}

async function buscarProdutoOpenPrices(nome: string, codigo?: string) {
  if (codigo) {
    try {
      return await buscarOpenPricesJson<OpenPricesProduct>(
        `${OPEN_PRICES_URL}/products/code/${encodeURIComponent(codigo)}`,
      );
    } catch {
      // Continue with name search; the barcode may not exist in Open Prices yet.
    }
  }

  const parametros = new URLSearchParams({
    "product_name__like": nome,
    "price_count__gte": "1",
    size: "20",
    ordering: "-price_count",
  });
  const resposta = await buscarOpenPricesJson<OpenPricesPage>(
    `${OPEN_PRICES_URL}/products?${parametros.toString()}`,
  );
  const melhor = (resposta.items ?? [])
    .filter((produto) => !!produto.code && !!produto.product_name)
    .map((produto) => ({
      ...produto,
      score: similaridadeProduto(nome, produto.product_name ?? ""),
    }))
    .sort((a, b) => b.score - a.score)[0];
  return melhor && melhor.score >= 0.5 ? melhor : undefined;
}

function nomeLocalOpenPrices(local?: OpenPricesLocation | null) {
  return [
    local?.osm_brand,
    local?.osm_name,
    local?.osm_display_name,
    local?.osm_address_city,
  ]
    .filter(Boolean)
    .join(" ");
}

function coordenadasOpenPrices(local?: OpenPricesLocation | null): Coordinates | undefined {
  const lat = Number(local?.osm_lat);
  const lng = Number(local?.osm_lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && local?.osm_lat != null && local?.osm_lon != null
    ? { lat, lng }
    : undefined;
}

function valorDoRegistroOpenPrices(
  registro: OpenPricesRecord,
  item: InputItem,
  produto?: OpenPricesProduct,
) {
  const valor = Number(registro.price);
  if (!Number.isFinite(valor) || valor <= 0) return 0;

  const desejada = unidadeBase(item.unidade);
  if (registro.price_per === "KILOGRAM" && desejada?.tipo === "massa")
    return valor * (item.quantidade * desejada.fator / 1000);
  if (registro.price_per === "LITER" && desejada?.tipo === "volume")
    return valor * (item.quantidade * desejada.fator / 1000);
  if (registro.price_per === "UNIT" || desejada?.tipo === "contagem")
    return valor * item.quantidade;

  return mediaUnidade(
    valor,
    item.quantidade,
    item.unidade,
    produto?.product_quantity ?? undefined,
    produto?.product_quantity_unit ?? undefined,
  );
}

async function consultarOpenPrices(
  item: InputItem,
  codigo?: string,
  filtros?: { mercado?: string; local?: string; coordenadas?: Coordinates },
) {
  try {
    const produto = await buscarProdutoOpenPrices(item.nome, codigo);
    const codigoProduto = produto?.code ?? codigo;
    if (!codigoProduto) return null;

    const parametrosBase = new URLSearchParams({
      product_code: codigoProduto,
      currency: "BRL",
      type: "PRODUCT",
      "duplicate_of__isnull": "true",
      "date__gte": new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      size: "100",
      ordering: "-date",
    });

    // Primeira tentativa: restringe à região informada, quando disponível.
    const parametrosLocais = new URLSearchParams(parametrosBase);
    if (filtros?.coordenadas) {
      parametrosLocais.set("lat", String(filtros.coordenadas.lat));
      parametrosLocais.set("lon", String(filtros.coordenadas.lng));
      parametrosLocais.set("radius_km", "5");
    }

    const respostaLocal = await buscarOpenPricesJson<OpenPricesPage>(
      `${OPEN_PRICES_URL}/prices?${parametrosLocais.toString()}`,
    );
    let registros = (respostaLocal.items ?? []).filter(
      (registro) => Number(registro.price) > 0 && (!registro.currency || registro.currency === "BRL"),
    );

    if (filtros?.mercado?.trim()) {
      registros = registros.filter((registro) =>
        correspondeFilialSelecionada(
          filtros.mercado!,
          filtros.coordenadas,
          nomeLocalOpenPrices(registro.location),
          coordenadasOpenPrices(registro.location),
          [
            registro.location?.osm_name,
            registro.location?.osm_display_name,
            registro.location?.osm_brand,
          ],
        ),
      );
    } else if (!filtros?.coordenadas && filtros?.local?.trim()) {
      const cidade = normalizar(filtros.local.split(",")[0] ?? "");
      if (cidade.length > 2) {
        registros = registros.filter((registro) =>
          normalizar(registro.location?.osm_address_city ?? "").includes(cidade),
        );
      }
    }

    // Nunca substitui uma consulta de filial/região por preço nacional.
    // A referência nacional só é permitida quando nenhuma loja ou região foi escolhida.
    let abrangencia = "registros locais";
    if (
      registros.length === 0 &&
      !filtros?.mercado?.trim() &&
      !filtros?.coordenadas &&
      !filtros?.local?.trim()
    ) {
      const respostaAmpla = await buscarOpenPricesJson<OpenPricesPage>(
        `${OPEN_PRICES_URL}/prices?${parametrosBase.toString()}`,
      );
      registros = (respostaAmpla.items ?? []).filter(
        (registro) => Number(registro.price) > 0 && (!registro.currency || registro.currency === "BRL"),
      );
      abrangencia = "registros nacionais (não confirmados em uma filial)";
    }
    if (registros.length === 0) return null;
    const valores = registros
      .map((registro) => valorDoRegistroOpenPrices(registro, item, produto))
      .filter((valor) => Number.isFinite(valor) && valor > 0);
    if (valores.length === 0) return null;

    const datas = registros
      .map((registro) => registro.date ?? registro.created?.slice(0, 10) ?? "")
      .filter(Boolean)
      .sort();
    const loja = filtros?.mercado?.trim()
      ? filtros.mercado
      : registros[0]?.location?.osm_name ?? registros[0]?.location?.osm_brand ?? "Open Prices";

    return {
      nome: item.nome,
      precoUnitario: Math.round(mediana(valores) * 100) / 100,
      produto: produto?.product_name ?? registros[0]?.product_name ?? item.nome,
      mercado: abrangencia === "registros locais" ? loja : abrangencia,
      atualizadoEm: datas.at(-1) ?? "",
      fonte: "Open Prices",
    };
  } catch {
    // This is a complementary public dataset; failures must not disable PreçoMelhor.
    return null;
  }
}

export async function consultarPrecosObservados(
  itens: InputItem[],
  filtros: { mercado?: string; local?: string; coordenadas?: Coordinates },
) {
  if (itens.length > 20)
    throw new Error("Consulte até 20 itens por vez para respeitar a cota da fonte de preços.");

  const localResolvido = await resolverLocalidade(filtros.local);

  const resultados = await Promise.all(
    itens.map(async (item) => {
      let produtoMelhor: (SearchProduct & { ean: string; product_name: string; score: number }) | undefined;
      let dadosMelhor: ProductResponse | undefined;

      // PreçoMelhor continua ativo como primeira fonte já existente.
      try {
        const busca = await buscarJson<{ items?: SearchProduct[] }>(
          `${BASE_URL}/search?q=${encodeURIComponent(item.nome)}`,
        );
        produtoMelhor = (busca.items ?? [])
          .filter(
            (candidate): candidate is SearchProduct & { ean: string; product_name: string } =>
              !!candidate.ean && !!candidate.product_name,
          )
          .map((candidate) => ({
            ...candidate,
            score: similaridadeProduto(item.nome, candidate.product_name),
          }))
          .sort((a, b) => b.score - a.score)[0];
        if (produtoMelhor && produtoMelhor.score >= 0.25) {
          dadosMelhor = await buscarJson<ProductResponse>(
            `${BASE_URL}/product/${encodeURIComponent(produtoMelhor.ean)}`,
          );
        } else {
          produtoMelhor = undefined;
        }
      } catch {
        // Open Prices is still queried even if PreçoMelhor is temporarily unavailable.
      }

      // Prioriza ofertas do PreçoMelhor que correspondem à loja/filial escolhida.
      // Assim, um registro nacional do Open Prices não encobre um preço local real.
      if (produtoMelhor && dadosMelhor) {
        const ofertas = ofertaDaLoja(
          dadosMelhor.prices ?? [],
          filtros.mercado,
          filtros.coordenadas,
          localResolvido,
        );
        const valores = ofertas
          .map((oferta) => Number(oferta.promo_price ?? oferta.price))
          .filter((preco) => Number.isFinite(preco) && preco > 0);
        if (valores.length > 0) {
          const precoPacote = media(valores);
          const preco = mediaUnidade(
            precoPacote,
            item.quantidade,
            item.unidade,
            dadosMelhor.product?.normalized_value,
            dadosMelhor.product?.normalized_unit,
            dadosMelhor.product?.units_per_pack,
          );
          const datas = ofertas
            .map((oferta) => oferta.update_date ?? "")
            .filter(Boolean)
            .sort();
          return {
            nome: item.nome,
            precoUnitario: Math.round(preco * 100) / 100,
            produto: produtoMelhor.product_name,
            mercado: filtros.mercado?.trim()
              ? (ofertas[0]?.store_name ?? filtros.mercado)
              : filtros.coordenadas
                ? "mercados próximos"
                : "ofertas online monitoradas",
            atualizadoEm: datas.at(-1) ?? "",
            fonte: "PreçoMelhor",
          };
        }
      }

      const precoOpenPrices = await consultarOpenPrices(
        item,
        produtoMelhor?.ean,
        { ...filtros, local: localResolvido },
      );
      if (precoOpenPrices) return precoOpenPrices;

      return {
        nome: item.nome,
        precoUnitario: 0,
        produto: produtoMelhor?.product_name ?? "",
        mercado: "",
        atualizadoEm: "",
        fonte: "",
      };
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
      : localResolvido
        ? `ofertas associadas a ${localResolvido}`
        : "média das ofertas disponíveis no Brasil";
  const fontes = [...new Set(resultados.map((resultado) => resultado.fonte).filter(Boolean))];
  const observacao = [
    `Preços observados em ${escopo}. Fontes consultadas: ${fontes.length ? fontes.join(" e ") : "PreçoMelhor e Open Prices"}.`,
    dataMaisRecente ? `Registro mais recente entre os itens: ${dataMaisRecente.slice(0, 10)}.` : "",
    semPreco ? `${semPreco} item(ns) sem preço compatível nesta consulta.` : "",
    "Open Prices reúne registros comunitários e pode não cobrir todos os produtos ou mercados; preços online também podem diferir dos praticados na filial física.",
  ]
    .filter(Boolean)
    .join(" ");

  return { precos: resultados, observacao, dataColeta: dataMaisRecente ?? "" };
}
