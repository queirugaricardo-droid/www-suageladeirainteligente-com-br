import { calcularMediaPrecos } from "./market-price-average";
import { scoreProductName } from "./product-matching";
type InputItem = { nome: string; quantidade: number; unidade: string };
type Coordinates = { lat: number; lng: number };

type SearchProduct = {
  ean?: string;
  product_name?: string;
  store_count?: number;
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

function normalizarCodigoProduto(codigo: string) {
  const digitos = codigo.replace(/\\D/g, "");
  // GTIN-14 com zero à esquerda representa o mesmo GTIN-13.
  return digitos.length === 14 && digitos.startsWith("0") ? digitos.slice(1) : digitos || codigo;
}

// Geocodificadores podem marcar entradas diferentes do mesmo estabelecimento.
const RAIO_MAXIMO_FILIAL_KM = 0.75;

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
    const tokensSelecionados = tokens(nomeSelecionado);
    const tokensEncontrados = tokens(nomeEncontrado);
    const comuns = tokensSelecionados.filter((token) => tokensEncontrados.includes(token));
    const nomesSuficientementeIdentificados =
      tokensSelecionados.length >= 2 && tokensEncontrados.length >= 2
        ? comuns.length >= 2
        : normalizar(nomeSelecionado) === normalizar(nomeEncontrado);

    return (
      nomesSuficientementeIdentificados &&
      distanciaKm(coordenadasSelecionadas, coordenadasEncontradas) <= RAIO_MAXIMO_FILIAL_KM
    );
  }

  // Sem coordenadas, uma marca isolada (ex.: "Carrefour") não identifica filial.
  // Exige ao menos dois termos e igualdade integral com o nome da loja.
  const termosSelecionados = tokens(nomeSelecionado);
  if (termosSelecionados.length < 2) return false;
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

const cacheJson = new Map<string, { expiraEm: number; dados: unknown }>();
const CACHE_JSON_TTL_MS = 10 * 60 * 1000;

async function buscarJson<T>(url: string): Promise<T> {
  const agora = Date.now();
  const armazenado = cacheJson.get(url);
  if (armazenado && armazenado.expiraEm > agora) return armazenado.dados as T;

  const resposta = await fetch(url, {
    headers: {
      "User-Agent": "SuaGeladeiraInteligente/1.0 (+https://suageladeirainteligente.com.br)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resposta.ok) throw new Error(`Fonte de preços indisponível (${resposta.status}).`);

  const dados = (await resposta.json()) as T;
  if (cacheJson.size > 500) {
    for (const [chave, valor] of cacheJson) {
      if (valor.expiraEm <= agora) cacheJson.delete(chave);
    }
  }
  cacheJson.set(url, { expiraEm: agora + CACHE_JSON_TTL_MS, dados });
  return dados;
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
    const cidade = normalizar(local?.split(",")[0] ?? "");
    disponiveis = disponiveis.filter((oferta) => {
      const ponto = coordenadasDaLoja(oferta.store_coords);
      // Use distância quando a fonte fornece coordenadas; quando não fornece,
      // aceite somente loja identificada na mesma cidade informada pelo usuário.
      if (ponto) return distanciaKm(coordenadas, ponto) <= 5;
      return cidade.length > 2 && normalizar(oferta.city_name ?? "").includes(cidade);
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

type OpenPricesProductsPage = { items?: OpenPricesProduct[] };
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
      const produtoPorCodigo = await buscarOpenPricesJson<OpenPricesProduct>(
        `${OPEN_PRICES_URL}/products/code/${encodeURIComponent(codigo)}`,
      );
      // Código de barras não dispensa a validação do nome: nunca atribuir preço
      // de um cadastro que não corresponde ao alimento reconhecido.
      if (
        produtoPorCodigo.product_name &&
        scoreProductName(nome, produtoPorCodigo.product_name) === 1
      ) {
        return produtoPorCodigo;
      }
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
  const resposta = await buscarOpenPricesJson<OpenPricesProductsPage>(
    `${OPEN_PRICES_URL}/products?${parametros.toString()}`,
  );
  const melhor = (resposta.items ?? [])
    .filter((produto) => !!produto.code && !!produto.product_name)
    .map((produto) => ({
      ...produto,
      score: scoreProductName(nome, produto.product_name ?? ""),
    }))
    .sort((a, b) => b.score - a.score)[0];
  return melhor && melhor.score === 1 ? melhor : undefined;
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
      "date__gte": new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
      (registro) => Number(registro.price) > 0 && registro.currency === "BRL",
    );

    // A API pode retornar registros fora do raio solicitado em alguns cenários.
    // Revalida distância e exige uma localização identificável para preço regional.
    if (filtros?.coordenadas && !filtros?.mercado?.trim()) {
      const cidade = normalizar(filtros.local?.split(",")[0] ?? "");
      registros = registros.filter((registro) => {
        const ponto = coordenadasOpenPrices(registro.location);
        const nomeMercado = registro.location?.osm_name?.trim() || registro.location?.osm_brand?.trim();
        if (!nomeMercado) return false;
        if (ponto) return distanciaKm(filtros.coordenadas!, ponto) <= 5;
        // Alguns registros públicos não têm latitude/longitude, mas identificam
        // o estabelecimento e a cidade. Não os descarte se a cidade coincidir.
        const cidadeRegistro = normalizar(registro.location?.osm_address_city ?? "");
        return cidade.length > 2 && cidadeRegistro === cidade;
      });
    }

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
        (registro) => Number(registro.price) > 0 && registro.currency === "BRL",
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
    const nomesMercados = [
      ...new Set(
        registros
          .map((registro) => registro.location?.osm_name?.trim() || registro.location?.osm_brand?.trim())
          .filter((nome): nome is string => !!nome),
      ),
    ];
    // Em consulta regional, não exibe preço sem identificar o estabelecimento real.
    if (filtros?.coordenadas && !filtros?.mercado?.trim() && nomesMercados.length === 0) {
      return null;
    }
    const loja = filtros?.mercado?.trim()
      ? filtros.mercado
      : nomesMercados.join(", ") || "Open Prices";

    return {
      nome: item.nome,
      precoUnitario: calcularMediaPrecos(valores),
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
      let ofertasMelhor: NonNullable<ProductResponse["prices"]> = [];

      // PreçoMelhor é gratuito e permite consultar os preços por filial.
      // Se a busca completa não encontrar preço local, tenta também os termos
      // específicos (marca/variante) sem a primeira palavra genérica do alimento.
      try {
        const termosAlternativos = tokens(item.nome)
          .slice(1)
          .filter((token) => !/^\\d/.test(token));
        const consultas = [item.nome];
        if (termosAlternativos.length >= 2) consultas.push(termosAlternativos.join(" "));

        const codigosTentados = new Set<string>();
        for (const consulta of consultas) {
          const busca = await buscarJson<{ items?: SearchProduct[] }>(
            `${BASE_URL}/search?q=${encodeURIComponent(consulta)}`,
          );
          const candidatos = (busca.items ?? [])
            .filter(
              (candidate): candidate is SearchProduct & { ean: string; product_name: string } =>
                !!candidate.ean && !!candidate.product_name,
            )
            .map((candidate) => ({
              ...candidate,
              score: scoreProductName(item.nome, candidate.product_name),
            }))
            .filter((candidate) => candidate.score === 1)
            .sort((a, b) => (b.store_count ?? 0) - (a.store_count ?? 0))
            .slice(0, filtros.mercado?.trim() ? 6 : filtros.coordenadas || localResolvido ? 3 : 1);

          for (const candidato of candidatos) {
            const codigoNormalizado = normalizarCodigoProduto(candidato.ean);
            if (codigosTentados.has(codigoNormalizado)) continue;
            codigosTentados.add(codigoNormalizado);

            const dados = await buscarJson<ProductResponse>(
              `${BASE_URL}/product/${encodeURIComponent(codigoNormalizado)}`,
            );
            const nomeConfirmado = dados.product?.product_name ?? candidato.product_name;
            if (scoreProductName(item.nome, nomeConfirmado) !== 1) continue;

            const candidatoConfirmado = {
              ...candidato,
              ean: codigoNormalizado,
              product_name: nomeConfirmado,
            };
            const ofertas = ofertaDaLoja(
              dados.prices ?? [],
              filtros.mercado,
              filtros.coordenadas,
              localResolvido,
            );

            if (!produtoMelhor) {
              produtoMelhor = candidatoConfirmado;
              dadosMelhor = dados;
            }

            if (ofertas.length > 0) {
              produtoMelhor = candidatoConfirmado;
              dadosMelhor = dados;
              ofertasMelhor = ofertas;
              break;
            }
          }
          if (ofertasMelhor.length > 0) break;
        }
      } catch {
        // Open Prices is still queried even if PreçoMelhor is temporarily unavailable.
      }

      // Prioriza a variante que realmente possui oferta compatível com a filial.
      // Assim, não exibe o preço de outra unidade da rede como se fosse da escolhida.
      if (produtoMelhor && dadosMelhor) {
        const ofertas = ofertasMelhor.length
          ? ofertasMelhor
          : ofertaDaLoja(
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
          const nomesMercados = [
            ...new Set(ofertas.map((oferta) => oferta.store_name?.trim()).filter((nome): nome is string => !!nome)),
          ];
          // Preço regional só é válido quando a fonte informa o nome do mercado.
          if (filtros.coordenadas && !filtros.mercado?.trim() && nomesMercados.length === 0) {
            return {
              nome: item.nome,
              precoUnitario: 0,
              produto: produtoMelhor.product_name,
              mercado: "",
              atualizadoEm: "",
              fonte: "",
            };
          }
          return {
            nome: item.nome,
            precoUnitario: Math.round(preco * 100) / 100,
            produto: produtoMelhor.product_name,
            mercado: filtros.mercado?.trim()
              ? (ofertas[0]?.store_name ?? filtros.mercado)
              : filtros.coordenadas
                ? nomesMercados.join(", ")
                : "ofertas online monitoradas",
            atualizadoEm: datas.at(-1) ?? "",
            fonte: "PreçoMelhor",
          };
        }
      }

      const precoOpenPrices = await consultarOpenPrices(
        item,
        produtoMelhor?.ean,
        { ...filtros, ...(localResolvido ? { local: localResolvido } : {}) },
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


type IeaRow = {
  produto: string;
  mes: number;
  ano: number;
  preco: number;
  unidade: string;
};

type IeaPrice = {
  nome: string;
  precoUnitario: number;
  produto: string;
  mercado: string;
  atualizadoEm: string;
  fonte: "IEA";
};

const IEA_URL = "https://infoiea.agricultura.sp.gov.br/nia1/precos_medios.aspx?cod_sis=4";
const IEA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheIeaRows = new Map<string, { expiraEm: number; row: IeaRow }>();

function produtoIeaParaItem(nome: string): string | undefined {
  const n = normalizar(nome);

  if (n.includes("arroz")) {
    if (/\b(integral|parboilizado|parbolizado)\b/.test(n)) return undefined;
    return "Arroz";
  }
  if (n.includes("leite condensado")) return "Leite Condensado";
  if (n.includes("leite em po")) return "Leite em Po";
  if (n.includes("leite")) return "Leite Longa Vida";
  if (n.includes("feijao")) {
    if (/\b(preto|carioca|fradinho|macacar)\b/.test(n)) return undefined;
    return "Feijao";
  }
  if (n.includes("tomate")) return "Tomate de Mesa";
  if (n.includes("banana prata")) return "Banana-Prata";
  if (n.includes("banana nanica")) return "Banana-Nanica";
  if (n.includes("banana maca")) return "Banana-Maca";
  if (n.includes("banana")) return "Banana-Prata";
  if (n.includes("batata doce")) return "Batata-Doce";
  if (n.includes("batata")) return "Batata";
  if (n.includes("cebola")) return "Cebola";
  if (n.includes("cenoura")) return "Cenoura";
  if (n.includes("alface")) return "Alface";
  if (n.includes("abobrinha italiana")) return "Abobrinha Italiana";
  if (n.includes("abobrinha")) return "Abobrinha Brasileira";
  if (n.includes("abobora")) return "Abobora";
  if (n.includes("brocolis")) return "Brócolis";
  if (n.includes("couve flor")) return "Couve-Flor";
  if (n.includes("couve")) return "Couve";
  if (n.includes("espinafre")) return "Espinafre";
  if (n.includes("beterraba")) return "Beterraba (kg)";
  if (n.includes("pepino")) return "Pepino";
  if (n.includes("pimentao")) return "Pimentao";
  if (n.includes("repolho")) return "Repolho Verde";
  if (n.includes("mandioca")) return "Mandioca de Mesa";
  if (n.includes("limao")) return "Limao";
  if (n.includes("laranja")) return "Laranja";
  if (n.includes("abacate")) return "Abacate";
  if (n.includes("abacaxi")) return "Abacaxi";
  if (n.includes("maca")) return "Maça Nacional (kg)";
  if (n.includes("manga")) return "Manga";
  if (n.includes("morango")) return "Morango";
  if (n.includes("melancia")) return "Melancia";
  if (n.includes("melao")) return "Melao Amarelo";
  if (n.includes("uva")) return "Uva Comum";
  if (n.includes("ovos") || n === "ovo") return "Ovos";
  if (n.includes("iogurte natural")) return "Iogurte Natural";
  if (n.includes("queijo") && n.includes("mussarela")) return "Queijo-Tipo Mussarela";
  if (n.includes("queijo") && n.includes("minas")) return "Queijo-Tipo Minas";
  if (n.includes("manteiga")) return "Manteiga";
  if (n.includes("margarina")) return "Margarina";
  if (n.includes("cafe soluvel")) return "Cafe Soluvel";
  if (n.includes("cafe")) return "Cafe em Po";
  if (n.includes("oleo de soja")) return "Oleo de Soja";
  if (n.includes("macarrao")) return "Macarrao";
  if (n.includes("pao frances")) return "Pao Frances";
  if (n.includes("pao de forma")) return "Pão de Forma";
  if (n.includes("acém") || n.includes("acem")) return "Acém";
  if (n.includes("patinho")) return "Patinho";
  if (n.includes("alcatra")) return "Alcatra";
  if (n.includes("file de frango")) return "Filé de Frango";
  if (n.includes("peito de frango")) return "Peito de Frango";
  if (n.includes("coxa de frango")) return "Coxa de Frango";
  if (n.includes("sobrecoxa")) return "Sobrecoxa de Frango";
  if (n.includes("frango")) return "Frango Limpo";
  if (n.includes("carne bovina")) return "Carne Bovina";
  if (n.includes("carne suina")) return "Carne Suina";
  if (n.includes("linguica")) return "Linguica de Porco";
  if (n.includes("bacon")) return "Bacon";
  if (n.includes("mortadela")) return "Mortadela";
  if (n.includes("presunto")) return "Presunto Cozido";
  if (n.includes("salsicha")) return "Salsicha-Tipo Hot-dog";
  return undefined;
}

function converterPrecoIea(preco: number, unidadeFonte: string, item: InputItem) {
  const desejada = unidadeBase(item.unidade);
  const origem = unidadeBase(unidadeFonte);
  if (desejada && origem && desejada.tipo === origem.tipo) {
    return preco * (item.quantidade * desejada.fator / origem.fator);
  }

  if (desejada?.tipo === "contagem" && normalizar(unidadeFonte).includes("duzia")) {
    return (preco * item.quantidade) / 12;
  }

  // Para produtos embalados vendidos por kg/litro, converte somente quando
  // o tamanho da embalagem estiver explícito no nome do item.
  if (desejada?.tipo === "contagem" || normalizar(item.unidade) === "pacote") {
    const tamanho = item.nome.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)\b/i);
    if (!tamanho) return undefined;
    const quantidadePacote = Number(tamanho[1].replace(",", "."));
    const unidadePacote = unidadeBase(tamanho[2]);
    if (!unidadePacote || !origem || unidadePacote.tipo !== origem.tipo) return undefined;
    return preco * quantidadePacote * unidadePacote.fator / origem.fator * item.quantidade;
  }

  return undefined;
}

function decodificarHtml(valor: string) {
  return valor
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_match, numero: string) => String.fromCodePoint(Number(numero)))
    .replace(/&#x([\da-f]+);/gi, (_match, numero: string) => String.fromCodePoint(parseInt(numero, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function consultarPrecosIea(itens: InputItem[], local?: string): Promise<Map<string, IeaPrice>> {
  const resultado = new Map<string, IeaPrice>();
  // A pesquisa do IEA é uma média de varejo da cidade de São Paulo.
  // Não a aplicamos a outras cidades nem a apresentamos como preço de uma filial.
  if (!local || !normalizar(local).includes("sao paulo")) return resultado;

  const mapeados = itens
    .map((item) => ({ item, produtoIea: produtoIeaParaItem(item.nome) }))
    .filter((registro): registro is { item: InputItem; produtoIea: string } => !!registro.produtoIea);
  if (mapeados.length === 0) return resultado;

  const agora = Date.now();
  const produtosPendentes = [...new Set(mapeados.map((registro) => registro.produtoIea))].filter((produto) => {
    const cache = cacheIeaRows.get(normalizar(produto));
    return !cache || cache.expiraEm <= agora;
  });

  if (produtosPendentes.length > 0) {
    try {
      const pagina = await fetch(IEA_URL, {
        headers: { Accept: "text/html", "User-Agent": "SuaGeladeiraInteligente/1.0 (+https://suageladeirainteligente.com.br)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!pagina.ok) throw new Error("IEA indisponível.");
      const html = await pagina.text();
      const formulario = new URLSearchParams();

      for (const correspondencia of html.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
        const tag = correspondencia[0];
        const nome = tag.match(/name="([^"]+)"/i)?.[1];
        const valor = tag.match(/value="([^"]*)"/i)?.[1] ?? "";
        if (nome) formulario.set(nome, valor);
      }

      const opcoesPeriodo = (nome: string) => {
        const select = html.match(new RegExp('<select[^>]*name="' + nome + '"[^>]*>([\\s\\S]*?)</select>', "i"))?.[1] ?? "";
        return [...select.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/gi)].map((opcao) => opcao[1]);
      };
      const periodosIniciais = opcoesPeriodo("cmbPeriodo_Inicial");
      const periodosFinais = opcoesPeriodo("cmbPeriodo_Final");
      const periodoInicial = periodosIniciais[0];
      const periodoFinal = periodosFinais.at(-1);
      if (!periodoInicial || !periodoFinal) throw new Error("Períodos do IEA indisponíveis.");

      formulario.set("cmbPeriodo_Inicial", periodoInicial);
      formulario.set("cmbPeriodo_Final", periodoFinal);

      const indicesProdutos = new Map<string, string>();
      for (const correspondencia of html.matchAll(/<input id="chkLstItens_(\d+)" type="checkbox" name="chkLstItens\$(\d+)"\s*\/>\s*<label for="chkLstItens_\d+">([^<]+)<\/label>/gi)) {
        indicesProdutos.set(normalizar(decodificarHtml(correspondencia[3] ?? "")), correspondencia[2] ?? correspondencia[1] ?? "");
      }
      for (const produto of produtosPendentes) {
        const indice = indicesProdutos.get(normalizar(produto));
        if (indice) formulario.set("chkLstItens$" + indice, "on");
      }
      formulario.set("imgPesquisar", "Pesquisar");

      const resposta = await fetch(IEA_URL, {
        method: "POST",
        headers: {
          Accept: "text/html",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://infoiea.agricultura.sp.gov.br",
          Referer: IEA_URL,
          "User-Agent": "SuaGeladeiraInteligente/1.0 (+https://suageladeirainteligente.com.br)",
        },
        body: formulario.toString(),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resposta.ok) throw new Error("Consulta de preços do IEA indisponível.");
      const resultadoHtml = await resposta.text();
      const tabela = resultadoHtml.match(/<table[^>]*id="Grid"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? "";
      const linhas = [...tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((linha) => [...(linha[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((celula) => decodificarHtml(celula[1] ?? "")))
        .filter((colunas) => colunas.length >= 6);

      for (const produto of produtosPendentes) {
        const linha = linhas
          .filter((colunas) => normalizar(colunas[0] ?? "") === normalizar(produto))
          .map((colunas) => ({
            produto: colunas[0] ?? produto,
            mes: Number(colunas[1]),
            ano: Number(colunas[2]),
            preco: Number((colunas[4] ?? "").replace(/\./g, "").replace(",", ".")),
            unidade: colunas[5] ?? "",
          }))
          .filter((registro) => registro.mes >= 1 && registro.mes <= 12 && registro.ano >= 2000 && registro.preco > 0)
          .sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes))
          .at(-1);
        if (linha) cacheIeaRows.set(normalizar(produto), { expiraEm: agora + IEA_CACHE_TTL_MS, row: linha });
      }
    } catch {
      // A fonte pública é complementar; uma indisponibilidade não interrompe as demais.
    }
  }

  for (const { item, produtoIea } of mapeados) {
    const linha = cacheIeaRows.get(normalizar(produtoIea))?.row;
    if (!linha) continue;
    const preco = converterPrecoIea(linha.preco, linha.unidade, item);
    if (!preco || !Number.isFinite(preco) || preco <= 0) continue;
    const mesAno = String(linha.mes).padStart(2, "0") + "/" + linha.ano;
    resultado.set(item.nome, {
      nome: item.nome,
      precoUnitario: Math.round(preco * 100) / 100,
      produto: linha.produto + " (média genérica de varejo, sem marca)",
      mercado: "IEA — média do varejo da cidade de São Paulo (" + mesAno + "); não é preço da filial",
      atualizadoEm: String(linha.ano) + "-" + String(linha.mes).padStart(2, "0") + "-01",
      fonte: "IEA",
    });
  }
  return resultado;
}

type LojaConsulta = { nome: string; lat?: number | undefined; lng?: number | undefined };

/** Consulta cada filial encontrada e calcula a média apenas dos preços observados compatíveis. */
export async function consultarPrecosEmMercados(
  itens: InputItem[],
  filtros: { local?: string; coordenadas?: Coordinates },
  lojas: LojaConsulta[],
) {
  const lojasUnicas = lojas
    .filter((loja) => loja.nome.trim())
    .filter(
      (loja, index, lista) =>
        lista.findIndex(
          (outra) =>
            normalizar(outra.nome) === normalizar(loja.nome) &&
            (outra.lat === undefined ||
              loja.lat === undefined ||
              distanciaKm(
                { lat: outra.lat, lng: outra.lng! },
                { lat: loja.lat, lng: loja.lng! },
              ) < 0.35),
        ) === index,
    );

  const consultas: Array<{
    loja: LojaConsulta;
    precos: Awaited<ReturnType<typeof consultarPrecosObservados>>["precos"];
  }> = [];
  // Limita a concorrência para não disparar dezenas de consultas simultâneas nas fontes gratuitas.
  let proxima = 0;
  const trabalhadores = Array.from({ length: Math.min(3, lojasUnicas.length) }, async () => {
    while (proxima < lojasUnicas.length) {
      const indice = proxima++;
      const loja = lojasUnicas[indice];
      if (!loja) continue;
      try {
        const { coordenadas: _coordenadasDaPessoa, ...filtrosSemCoordenadas } = filtros;
        const resultado = await consultarPrecosObservados(itens, {
          ...filtrosSemCoordenadas,
          mercado: loja.nome,
          ...(loja.lat !== undefined && loja.lng !== undefined
            ? { coordenadas: { lat: loja.lat, lng: loja.lng } }
            : {}),
        });
        consultas[indice] = { loja, precos: resultado.precos };
      } catch {
        consultas[indice] = { loja, precos: [] };
      }
    }
  });
  await Promise.all(trabalhadores);

  // Segunda etapa: sem preço nas filiais escolhidas, consulta a base regional
  // usando o GPS original. O nome da fonte é mantido para não atribuir o preço
  // regional à filial selecionada.
  const precosRegionais = new Map<string, Awaited<ReturnType<typeof consultarPrecosObservados>>["precos"][number]>();
  if (filtros.coordenadas) {
    const itensSemPreco = itens.filter((item) =>
      !consultas.some(({ precos: lista }) => lista.some((registro) => registro.nome === item.nome && registro.precoUnitario > 0)),
    );
    const resultadosRegionais = await Promise.all(itensSemPreco.map(async (item) => {
      try {
        const regional = await consultarPrecosObservados([item], {
          ...(filtros.local ? { local: filtros.local } : {}),
          coordenadas: filtros.coordenadas!,
        });
        const registro = regional.precos.find((preco) => preco.precoUnitario > 0 && preco.mercado.trim());
        return registro ? [item.nome, registro] as const : null;
      } catch {
        return null;
      }
    }));
    for (const resultado of resultadosRegionais) if (resultado) precosRegionais.set(resultado[0], resultado[1]);
  }

  // Terceira etapa: se não houver observação nas filiais nem na região,
  // consulta os preços públicos disponíveis em todo o Brasil. A origem é
  // identificada como nacional e nunca é apresentada como preço da loja local.
  const precosNacionais = new Map<string, Awaited<ReturnType<typeof consultarPrecosObservados>>["precos"][number]>();
  const itensSemPrecoLocal = itens.filter((item) =>
    !consultas.some(({ precos: lista }) => lista.some((registro) => registro.nome === item.nome && registro.precoUnitario > 0)) &&
    !precosRegionais.has(item.nome),
  );
  const resultadosNacionais = await Promise.all(itensSemPrecoLocal.map(async (item) => {
    try {
      const nacional = await consultarPrecosObservados([item], {});
      const registro = nacional.precos.find((preco) => preco.precoUnitario > 0 && preco.mercado.trim());
      return registro ? [item.nome, registro] as const : null;
    } catch {
      return null;
    }
  }));
  for (const resultado of resultadosNacionais) if (resultado) precosNacionais.set(resultado[0], resultado[1]);

  // Complementa os dados comunitários com a média oficial de varejo do IEA,
  // somente para usuários em São Paulo e quando não existe preço local observado.
  const itensSemPrecoParaIea = itens.filter((item) =>
    !consultas.some(({ precos: lista }) => lista.some((registro) => registro.nome === item.nome && registro.precoUnitario > 0)) &&
    !precosRegionais.has(item.nome),
  );
  const precosIea = await consultarPrecosIea(itensSemPrecoParaIea, filtros.local);
  for (const [nome, registro] of precosIea) precosRegionais.set(nome, registro);

  const precos = itens.map((item) => {
    const encontrados = consultas.flatMap(({ loja, precos: lista }) => {
      const preco = lista.find(
        (registro) => registro.nome === item.nome && registro.precoUnitario > 0,
      );
      return preco ? [{ ...preco, loja: loja.nome }] : [];
    });
    const regional = precosRegionais.get(item.nome);
    const nacional = precosNacionais.get(item.nome);
    const valores = encontrados.map((registro) => registro.precoUnitario);
    const precoCalculado = encontrados.length
      ? calcularMediaPrecos(valores)
      : (regional?.precoUnitario ?? nacional?.precoUnitario ?? 0);
    const datas = encontrados.map((registro) => registro.atualizadoEm ?? "").filter(Boolean).sort();
    const usarRegional = encontrados.length === 0 && regional !== undefined;
    const usarIea = usarRegional && regional.fonte === "IEA";
    const usarNacional = encontrados.length === 0 && !usarRegional && nacional !== undefined;
    return {
      nome: item.nome,
      precoUnitario: precoCalculado,
      produto: encontrados[0]?.produto ?? regional?.produto ?? nacional?.produto ?? "",
      mercado: encontrados.length
        ? `Média de ${encontrados.length} mercado(s)`
        : usarIea
          ? regional.mercado
          : usarRegional
            ? `${regional.mercado} (preço regional)`
            : usarNacional
              ? `${nacional.mercado} (referência nacional, não é preço da filial)`
              : "",
      atualizadoEm: datas.at(-1) ?? regional?.atualizadoEm ?? nacional?.atualizadoEm ?? "",
      mercadosConsultados: encontrados.length
        ? encontrados.map((registro) => registro.loja)
        : usarRegional
          ? [regional.mercado]
          : usarNacional
            ? [`${nacional.mercado} (referência nacional)`]
            : [],
      quantidadeMercados: encontrados.length || (usarRegional || usarNacional ? 1 : 0),
      tipoPreco: encontrados.length ? "filiais selecionadas" : usarIea ? "referência IEA" : usarRegional ? "regional" : usarNacional ? "nacional" : "indisponível",
    };
  });

  const totalComPreco = precos.filter((preco) => preco.precoUnitario > 0).length;
  const maiorData = precos.map((preco) => preco.atualizadoEm).filter(Boolean).sort().at(-1) ?? "";
  const totalRegional = precos.filter((preco) => preco.tipoPreco === "regional").length;
  const totalIea = precos.filter((preco) => preco.tipoPreco === "referência IEA").length;
  const totalNacional = precos.filter((preco) => preco.tipoPreco === "nacional").length;
  const observacao = `Pesquisa automática em ${lojasUnicas.length} supermercado(s) encontrado(s). Primeiro foram consultadas as filiais selecionadas; sem preço nelas, foi feita busca regional, média oficial do varejo do IEA quando a cidade é São Paulo e, por último, referência nacional nas fontes públicas. Médias regionais, do IEA e nacionais são identificadas e nunca atribuídas à filial escolhida. ${totalComPreco} de ${itens.length} produto(s) tiveram preço: ${totalRegional} regional(is), ${totalIea} referência(s) IEA e ${totalNacional} nacional(is). Produtos sem registro continuam sem preço.`;
  return { precos, observacao, dataColeta: maiorData };
}


/** Consulta preços observados na região e usa a média pública do IEA apenas como complemento para a cidade de São Paulo. */
export async function consultarMediaRegional(
  itens: InputItem[],
  filtros: { local?: string; coordenadas?: Coordinates },
) {
  const observado = await consultarPrecosObservados(itens, filtros);
  const localResolvido = await resolverLocalidade(filtros.local);
  const referenciasIea = await consultarPrecosIea(itens, localResolvido);
  const precos = observado.precos.map((preco) => {
    if (preco.precoUnitario > 0) return preco;
    const referencia = referenciasIea.get(preco.nome);
    return referencia ? { ...referencia, tipoPreco: "referência IEA" } : preco;
  });
  const comPreco = precos.filter((preco) => preco.precoUnitario > 0).length;
  const observacao = [
    observado.observacao,
    referenciasIea.size > 0
      ? "Para itens sem registro local, foi usada a média oficial de varejo do IEA da cidade de São Paulo, identificada separadamente; ela não representa uma filial nem outras cidades."
      : "",
    `${comPreco} de ${itens.length} produto(s) têm valor disponível. Itens sem fonte compatível permanecem sem preço.`,
  ].filter(Boolean).join(" ");
  return { precos, observacao, dataColeta: observado.dataColeta };
}
