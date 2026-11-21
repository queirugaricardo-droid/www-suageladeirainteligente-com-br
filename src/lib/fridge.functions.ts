import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { imagensAnaliseSchema } from "./plano";
import { chaveGemini } from "./deploy-config";
import { CATEGORIAS_DETECCAO, type CategoriaDeteccao } from "./fridge-types";

type ClienteSb = { rpc: (...a: any[]) => any };

function extrairJson(texto: string) {
  const limpo = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("Não consegui interpretar a resposta da IA.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

function erroAmigavel(e: unknown) {
  const texto = e instanceof Error ? e.message : "";
  if (texto.includes("402")) return "O serviço de análise está temporariamente sem créditos.";
  if (texto.includes("429")) return "Muitas solicitações em pouco tempo. Aguarde e tente novamente.";
  if (texto.includes("403")) return "O serviço de análise não está autorizado no momento.";
  if (texto.includes("503")) return "O serviço de análise está temporariamente indisponível.";
  return "Não foi possível concluir a análise. Tente novamente.";
}

const respostaGeminiSchema = z.object({
  itens: z.array(z.object({
    nome: z.string().trim().min(1).max(120),
    quantidade: z.number().finite().positive().max(10_000),
    unidade: z.enum(["un", "kg", "g", "L", "ml", "pacote"]),
    estimado: z.boolean(),
    confianca: z.number().finite().min(0).max(1),
    emoji: z.string().max(8),
    categoria: z.enum(["Frutas", "Verduras e legumes", "Laticínios", "Bebidas", "Carnes", "Ovos", "Outros"]),
  }).strict()).max(200),
}).strict();

export const analisarFoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => imagensAnaliseSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const sb = context.supabase as unknown as ClienteSb;
      const { data: autorizado, error: erroReserva } = await sb.rpc(
        "reservar_analise_foto",
        { p_fotos: data.imagens.length },
      );
      if (erroReserva) {
        console.error("Falha ao validar limite temporário de análises.");
        throw new Error("Não foi possível validar a solicitação. Tente novamente.");
      }
      if (autorizado !== true) {
        throw new Error("429: muitas análises em pouco tempo. Aguarde um minuto e tente novamente.");
      }
      const messages = [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: [
                  "Você é um inspetor visual meticuloso de geladeiras abertas.",
                  data.imagens.length > 1
                    ? `Você recebeu ${data.imagens.length} fotos da MESMA geladeira, de ângulos diferentes. Analise todas juntas e consolide os itens sem duplicar o mesmo alimento visto em mais de uma foto.`
                    : "",
                  "Faça uma varredura sistemática por zonas antes de responder: (1) porta e compartimentos da porta, (2) prateleiras superiores, (3) prateleiras centrais, (4) prateleiras inferiores, (5) gavetas de hortifrúti e áreas parcialmente visíveis.",
                  "Liste TODOS os alimentos e bebidas realmente visíveis, em português do Brasil, agrupando aparições do mesmo alimento.",
                  "Para itens discretos, conte cuidadosamente cada unidade visível — especialmente ovos, tomates, maçãs, latas, potes e garrafas — sem estimar por embalagem quando as unidades puderem ser vistas.",
                  "Separe identificação de quantidade: você NÃO consegue medir peso nem volume exatos por foto. Para líquidos, carnes, queijos, frutas a granel e produtos parcialmente consumidos, prefira contar embalagens/unidades (un ou pacote); se precisar usar g, kg, ml ou L, dê uma estimativa conservadora e marque \"estimado\": true.",
                  "Use \"confianca\" de 0 a 1 de forma honesta: abaixo de 0.9 quando o alimento estiver parcialmente encoberto, com rótulo ilegível ou quando houver dúvida sobre o que é.",
                  "Para identificar cada alimento com precisão: leia rótulos, marcas e textos visíveis nas embalagens; use formato, cor, textura, tampa e tipo de embalagem como pistas (ex.: caixa longa vida = leite ou suco, pote branco pequeno = iogurte ou requeijão); diferencie itens parecidos (leite x iogurte líquido, queijo x manteiga, tomate x pimentão, limão x lima) e, se não der para distinguir, use o nome mais genérico correto (ex.: \"Pote de laticínio\", \"Garrafa de bebida\") com confiança abaixo de 0.7.",
                  "Ignore objetos que não são alimento (potes vazios, utensílios, ímãs, partes da geladeira). Não liste o mesmo item duas vezes.",
                  "Conte SOMENTE unidades que você realmente enxerga; não deduza unidades escondidas pelo tamanho da embalagem ou bandeja. Se houver chance de unidades encobertas, informe só as visíveis e use confiança abaixo de 0.9.",
                  "Antes de responder, revise mentalmente a lista final: confirme que cada item está realmente visível e que a contagem confere com a imagem.",
                  "Associe a cada alimento exatamente um emoji Unicode representativo e específico.",
                   'Classifique cada item em exatamente uma categoria: Frutas, Verduras e legumes, Laticínios, Bebidas, Carnes, Ovos ou Outros.',
                   'Responda APENAS com JSON no formato: {"itens":[{"nome":"Tomates","quantidade":5,"unidade":"un","estimado":false,"confianca":0.8,"emoji":"🍅","categoria":"Verduras e legumes"}]}.',
                  "Unidades permitidas: un, kg, g, L, ml, pacote. Não invente itens ocultos, encobertos ou que não estejam visíveis.",
                ].join(" "),
              },
              ...data.imagens.map((imagem) => ({ type: "image" as const, image: imagem })),
            ],
          },
        ];
      const geminiKey = chaveGemini(process.env["GEMINI_API_KEY"]);
      if (!geminiKey) throw new Error("A análise de fotos não está configurada. Defina GEMINI_API_KEY no servidor.");
      const { gerarJsonGemini } = await import("./gemini.server");
      const prompt = messages[0]?.content.find(part => part.type === "text");
      const texto = await gerarJsonGemini(
        geminiKey,
        prompt?.type === "text" ? prompt.text : "",
        data.imagens,
        "gemini-3.5-flash",
      );
      // A resposta do modelo é dado externo: validar tudo antes de usar ou persistir.
      const json = respostaGeminiSchema.parse(extrairJson(texto));
      const itens = json.itens.map((i) => {
        const pesoOuVolume = ["g", "kg", "ml", "L"].includes(i.unidade);
        const estimado = i.estimado || pesoOuVolume;
        return {
          nome: i.nome,
          quantidade: i.quantidade,
          unidade: i.unidade,
          estimado,
          confianca: estimado ? Math.min(i.confianca, 0.85) : i.confianca,
          emoji: i.emoji,
          categoria: i.categoria,
        };
      });
      return { ok: true as const, itens };
    } catch (e) {
      console.error("Falha na análise da geladeira", {
        tipo: e instanceof Error ? e.name : "UnknownError",
      });
      return { ok: false as const, erro: erroAmigavel(e), itens: [] };
    }
  });

export const estimarPrecos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        itens: z
          .array(
            z.object({
              nome: z.string().trim().min(1).max(200),
              quantidade: z.number().positive().max(10_000),
              unidade: z.string().trim().min(1).max(20),
            }),
          )
          .min(1)
          .max(20),
        local: z.string().max(200).optional(),
        mercado: z.string().max(200).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      })
      .refine((data) => (data.lat === undefined) === (data.lng === undefined), {
        message: "Informe latitude e longitude juntas.",
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    try {
      const { consultarPrecosObservados } = await import("./market-prices.server");
      const resultado = await consultarPrecosObservados(data.itens, {
        ...(data.mercado ? { mercado: data.mercado } : {}),
        ...(data.local ? { local: data.local } : {}),
        ...(data.lat !== undefined && data.lng !== undefined ? { coordenadas: { lat: data.lat, lng: data.lng } } : {}),
      });
      return {
        ok: true as const,
        ...resultado,
        local: data.lat !== undefined ? data.local?.trim() ?? "" : "",
      };
    } catch (e) {
      console.error("Falha ao consultar preços observados", {
        tipo: e instanceof Error ? e.name : "UnknownError",
      });
      return { ok: false as const, erro: "Não foi possível consultar os preços agora. Tente novamente.", precos: [], observacao: "", dataColeta: "", local: "" };
    }
  });

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export const buscarMercados = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) {
      return {
        ok: false as const,
        conectado: false,
        erro: "Os mercados próximos ainda não estão disponíveis: falta conectar o serviço de mapas.",
        lojas: [],
        local: "",
      };
    }

    const base = "https://connector-gateway.lovable.dev/google_maps";
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
    };

    try {
      const resposta = await fetch(`${base}/places/v1/places:searchNearby`, {
        method: "POST",
        headers: {
          ...headers,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.rating",
        },
        body: JSON.stringify({
          includedTypes: ["supermarket", "grocery_store"],
          maxResultCount: 8,
          languageCode: "pt-BR",
          locationRestriction: {
            circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 5000 },
          },
        }),
      });

      if (!resposta.ok) {
        console.error(`Gateway Google Maps falhou [${resposta.status}]`);
        return {
          ok: false as const,
          conectado: true,
          erro: `Não consegui buscar mercados próximos (${resposta.status}).`,
          lojas: [],
          local: "",
        };
      }

      const json = (await resposta.json()) as {
        places?: Array<{
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          rating?: number;
        }>;
      };

      const lojas = (json.places ?? []).map((p) => ({
        nome: p.displayName?.text ?? "Mercado",
        endereco: p.formattedAddress ?? "",
        nota: p.rating,
        distanciaKm: p.location
          ? distanciaKm(
              { lat: data.lat, lng: data.lng },
              { lat: p.location.latitude, lng: p.location.longitude },
            )
          : undefined,
      }));
      lojas.sort((a, b) => (a.distanciaKm ?? 99) - (b.distanciaKm ?? 99));

      let local = "";
      const geo = await fetch(
        `${base}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=pt-BR`,
        { headers },
      );
      if (geo.ok) {
        const g = (await geo.json()) as { results?: Array<{ formatted_address?: string }> };
        local = g.results?.[0]?.formatted_address ?? "";
      }

      return { ok: true as const, conectado: true, lojas, local, erro: "" };
    } catch (e) {
      return {
        ok: false as const,
        conectado: true,
        erro: e instanceof Error ? e.message : "Falha ao buscar mercados próximos.",
        lojas: [],
        local: "",
      };
    }
  });
