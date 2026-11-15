import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imagensAnaliseSchema } from "./plano";
import { chaveGemini } from "./deploy-config";
import { CATEGORIAS_DETECCAO, type CategoriaDeteccao } from "./fridge-types";

type ClienteSb = { from: (t: "analises_foto") => any; rpc: (...a: any[]) => any };

function extrairJson(texto: string) {
  const limpo = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("Não consegui interpretar a resposta da IA.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

function erroAmigavel(e: unknown) {
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes("402")) return "Os créditos de IA do app acabaram. Adicione créditos para continuar.";
  if (texto.includes("429")) return "Muitas análises seguidas. Espere alguns segundos e tente de novo.";
  if (texto.includes("403")) return "O uso de IA está bloqueado nas configurações do app.";
  return texto || "Não foi possível concluir a análise.";
}

export const analisarFoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => imagensAnaliseSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    try {
      const sb = context.supabase as unknown as ClienteSb;
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
      const json = extrairJson(texto) as {
          itens?: Array<{ nome?: string; quantidade?: number; unidade?: string; estimado?: boolean; confianca?: number; emoji?: string; categoria?: string }>;
      };
      const itens = (json.itens ?? [])
        .filter((i) => typeof i.nome === "string" && i.nome.trim().length > 0)
        .map((i) => {
          const unidade = typeof i.unidade === "string" ? i.unidade : "un";
          const pesoOuVolume = ["g", "kg", "ml", "l"].includes(unidade.toLowerCase());
          const estimado = i.estimado === true || pesoOuVolume;
          const confiancaBase =
            typeof i.confianca === "number" && Number.isFinite(i.confianca)
              ? Math.max(0, Math.min(i.confianca, 1))
              : undefined;
          return {
            nome: String(i.nome).trim(),
            quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
            unidade,
            estimado,
            // Quantidade estimada nunca é apresentada como certeza.
            confianca: estimado ? Math.min(confiancaBase ?? 0.85, 0.85) : confiancaBase,
            emoji: typeof i.emoji === "string" ? i.emoji.trim() : undefined,
            categoria:
              typeof i.categoria === "string" &&
              (CATEGORIAS_DETECCAO as readonly string[]).includes(i.categoria.trim())
                ? (i.categoria.trim() as CategoriaDeteccao)
                : undefined,
          };
        });
      // Usage is telemetry only: it must never block an analysis.
      try {
        const { error: erroRegistro } = await sb
          .from("analises_foto")
          .insert({ user_id: context.userId, fotos: data.imagens.length });
        if (erroRegistro) console.error("Falha ao registrar estatística de fotos.");
      } catch {
        console.error("Falha ao registrar estatística de fotos.");
      }
      return { ok: true as const, itens };
    } catch (e) {
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
      const erro = e instanceof Error ? e.message : "Não foi possível consultar os preços observados.";
      return { ok: false as const, erro, precos: [], observacao: "", dataColeta: "", local: "" };
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
  .handler(async ({ data }) => {
    // Geoapify Places API: pesquisa supermercados e lojas de conveniência
    // num raio de 5 km. A chave fica exclusivamente no servidor (Vercel).
    const apiKey = process.env["GEOAPIFY_API_KEY"]?.trim();
    if (!apiKey) {
      return {
        ok: false as const,
        conectado: false,
        erro: "A busca de mercados ainda precisa ser configurada no servidor (GEOAPIFY_API_KEY).",
        lojas: [],
        local: "",
      };
    }

    try {
      const parametros = new URLSearchParams({
        categories: "commercial.supermarket,commercial.convenience",
        filter: `circle:${data.lng},${data.lat},5000`,
        bias: `proximity:${data.lng},${data.lat}`,
        limit: "100",
        lang: "pt",
        apiKey,
      });
      const resposta = await fetch(`https://api.geoapify.com/v2/places?${parametros.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });

      if (!resposta.ok) {
        console.error("Geoapify Places respondeu com status " + resposta.status + ".");
        const erro = resposta.status === 401 || resposta.status === 403
          ? "A chave da busca de mercados é inválida ou não está autorizada. Confira GEOAPIFY_API_KEY no Vercel."
          : resposta.status === 429
            ? "O limite gratuito diário da busca de mercados foi atingido. Tente novamente amanhã."
            : resposta.status >= 500
              ? "O serviço de localização está temporariamente indisponível. Tente novamente em instantes."
              : "Não foi possível consultar os mercados (erro " + resposta.status + ").";
        return { ok: false as const, conectado: true, erro, lojas: [], local: "" };
      }

      const json = (await resposta.json()) as {
        features?: Array<{
          properties?: {
            name?: string;
            formatted?: string;
            address_line1?: string;
            address_line2?: string;
            street?: string;
            housenumber?: string;
            suburb?: string;
            district?: string;
            city?: string;
            state?: string;
            lat?: number;
            lon?: number;
            distance?: number;
          };
        }>;
      };

      const vistos = new Set<string>();
      const lojas = (json.features ?? [])
        .map((feature) => {
          const p = feature.properties ?? {};
          const nome = p.name?.trim();
          if (!nome || typeof p.lat !== "number" || typeof p.lon !== "number") return null;
          const endereco = p.formatted?.trim() ||
            [p.address_line1, p.address_line2].filter(Boolean).join(", ") ||
            [p.street, p.housenumber].filter(Boolean).join(", ") ||
            "Endereço não informado";
          const chave = nome.toLocaleLowerCase("pt-BR") + "|" + endereco.toLocaleLowerCase("pt-BR");
          if (vistos.has(chave)) return null;
          vistos.add(chave);
          return {
            nome,
            endereco,
            distanciaKm: typeof p.distance === "number"
              ? Math.round((p.distance / 1000) * 10) / 10
              : distanciaKm({ lat: data.lat, lng: data.lng }, { lat: p.lat, lng: p.lon }),
            cidade: p.city ?? "",
            bairro: p.suburb ?? p.district ?? "",
            estado: p.state ?? "",
          };
        })
        .filter((loja): loja is NonNullable<typeof loja> => loja !== null)
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 8);

      const lojaComLocal = lojas.find((loja) => loja.cidade || loja.bairro);
      const local = lojaComLocal
        ? [lojaComLocal.bairro, lojaComLocal.cidade, lojaComLocal.estado].filter(Boolean).join(", ")
        : "";

      return {
        ok: true as const,
        conectado: true,
        lojas: lojas.map(({ nome, endereco, distanciaKm }) => ({ nome, endereco, distanciaKm })),
        local,
        erro: "",
      };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "";
      console.error("Falha ao consultar Geoapify Places.", mensagem);
      return {
        ok: false as const,
        conectado: true,
        erro: mensagem.includes("Timeout") || mensagem.includes("aborted")
          ? "A busca de mercados demorou demais. Tente novamente."
          : "Não foi possível consultar os mercados próximos agora.",
        lojas: [],
        local: "",
      };
    }
  });
