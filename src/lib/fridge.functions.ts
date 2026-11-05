import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { limiteFotos } from "./plano";
import { provedorFoto } from "./deploy-config";
import { CATEGORIAS_DETECCAO, type CategoriaDeteccao } from "./fridge-types";

const MODELO = "openai/gpt-6-astra";

function inicioDoMes() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

type ClienteSb = { from: (t: "analises_foto") => any; rpc: (...a: any[]) => any };

async function fotosUsadasNoMes(supabase: ClienteSb, userId: string) {
  const { data, error } = await supabase
    .from("analises_foto")
    .select("fotos")
    .eq("user_id", userId)
    .gte("created_at", inicioDoMes());
  if (error) throw new Error("Não consegui verificar seu limite de fotos.");
  return ((data ?? []) as { fotos: number }[]).reduce((t, r) => t + r.fotos, 0);
}

export const consultarUsoFotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as ClienteSb;
    const usadas = await fotosUsadasNoMes(sb, context.userId);
    const limite = limiteFotos();
    return { usadas, limite, restantes: Math.max(0, limite - usadas) };
  });

function criarProvedor() {
  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) throw new Error("O serviço de IA não está configurado.");
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: chave,
    headers: { "Lovable-API-Key": chave, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

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
  .inputValidator((input: unknown) =>
    z
      .object({
        imagens: z.array(z.string().min(50).max(12_000_000)).min(1).max(2),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    try {
      const sb = context.supabase as unknown as ClienteSb;
      const usadas = await fotosUsadasNoMes(sb, context.userId);
      const limite = limiteFotos();
      const restantes = limite - usadas;
      if (data.imagens.length > restantes) {
        return {
          ok: false as const,
          itens: [],
          erro:
            restantes <= 0
              ? `Você já usou suas ${limite} fotos deste mês. O limite renova no dia 1º.`
              : `Você só tem ${restantes} foto restante neste mês. Remova uma das fotos.`,
        };
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
      const geminiKey = process.env["GEMINI_API_KEY"]?.trim();
      let texto: string;
      if (provedorFoto(geminiKey) === "gemini" && geminiKey) {
        const { gerarJsonGemini } = await import("./gemini.server");
        const prompt = messages[0]?.content.find(part => part.type === "text");
        texto = await gerarJsonGemini(geminiKey, prompt?.type === "text" ? prompt.text : "", data.imagens, process.env["GEMINI_MODEL"]?.trim() || undefined);
      } else {
      const resultado = streamText({
        model: criarProvedor().responses(MODELO),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "high",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
        messages,
      });
        texto = await resultado.text;
      }
      const json = extrairJson(texto) as {
          itens?: Array<{ nome?: string; quantidade?: number; unidade?: string; estimado?: boolean; confianca?: number; emoji?: string; categoria?: string }>;
      };
      const itens = (json.itens ?? [])
        .filter((i) => typeof i.nome === "string" && i.nome.trim().length > 0)
        .map((i) => {
          const unidade = typeof i.unidade === "string" ? i.unidade : "un";
          const pesoOuVolume = ["g", "kg", "ml", "l"].includes(unidade.toLowerCase());
          const estimado = i.estimado === true || pesoOuVolume;
          const confiancaBase = typeof i.confianca === "number" ? i.confianca : undefined;
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
      const { error: erroRegistro } = await sb
        .from("analises_foto")
        .insert({ user_id: context.userId, fotos: data.imagens.length });
      if (erroRegistro) throw new Error("Não consegui registrar o uso de fotos.");
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
          .array(z.object({ nome: z.string(), quantidade: z.number(), unidade: z.string() }))
          .min(1)
          .max(60),
        local: z.string().max(200).optional(),
        mercado: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const local = data.local?.trim() || "Brasil (média nacional)";
      const messages = [
          {
            role: "user" as const,
            content: [
              `Estime o preço em reais (BRL) de cada item de supermercado abaixo na região: ${local}.`,
              data.mercado ? `Considere os preços típicos do mercado: ${data.mercado}.` : "",
              "Considere a quantidade indicada de cada item e devolva o preço total daquela quantidade.",
              'Responda APENAS com JSON: {"precos":[{"nome":"leite","precoUnitario":5.49}],"observacao":"texto curto"}.',
              "Itens:",
              data.itens.map((i) => `- ${i.nome}: ${i.quantidade} ${i.unidade}`).join("\n"),
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ];
      const geminiKey = process.env["GEMINI_API_KEY"]?.trim();
      let texto: string;
      if (geminiKey) {
        const { gerarJsonGemini } = await import("./gemini.server");
        texto = await gerarJsonGemini(geminiKey, messages[0]?.content ?? "", [], process.env["GEMINI_MODEL"]?.trim() || undefined);
      } else {
      const resultado = streamText({
        model: criarProvedor().responses(MODELO),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
        messages,
      });
        texto = await resultado.text;
      }
      const json = extrairJson(texto) as {
        precos?: Array<{ nome?: string; precoUnitario?: number }>;
        observacao?: string;
      };
      const precos = (json.precos ?? [])
        .filter((p) => typeof p.nome === "string" && Number(p.precoUnitario) >= 0)
        .map((p) => ({ nome: String(p.nome), precoUnitario: Number(p.precoUnitario) }));
      return {
        ok: true as const,
        precos,
        observacao: typeof json.observacao === "string" ? json.observacao : "",
        local,
      };
    } catch (e) {
      return { ok: false as const, erro: erroAmigavel(e), precos: [], observacao: "", local: "" };
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
        const corpo = await resposta.text();
        console.error(`Gateway Google Maps falhou [${resposta.status}]: ${corpo}`);
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
