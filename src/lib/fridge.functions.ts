import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const MODELO = "openai/gpt-6-astra";

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
  .handler(async ({ data }) => {
    try {
      const provedor = criarProvedor();
      const resultado = streamText({
        model: provedor.responses(MODELO),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "medium",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Você é um inspetor visual meticuloso de geladeiras abertas.",
                  data.imagens.length > 1
                    ? `Você recebeu ${data.imagens.length} fotos da MESMA geladeira, de ângulos diferentes. Analise todas juntas e consolide os itens sem duplicar o mesmo alimento visto em mais de uma foto.`
                    : "",
                  "Faça uma varredura sistemática por zonas antes de responder: (1) porta e compartimentos da porta, (2) prateleiras superiores, (3) prateleiras centrais, (4) prateleiras inferiores, (5) gavetas de hortifrúti e áreas parcialmente visíveis.",
                  "Liste TODOS os alimentos e bebidas realmente visíveis, em português do Brasil, agrupando aparições do mesmo alimento.",
                  "Para itens discretos, conte cuidadosamente cada unidade visível — especialmente ovos, tomates, maçãs, latas, potes e garrafas — sem estimar por embalagem quando as unidades puderem ser vistas.",
                  "Para líquidos, carnes, queijos e produtos parcialmente consumidos, estime a quantidade visível de forma conservadora.",
                  "Associe a cada alimento exatamente um emoji Unicode representativo e específico.",
                   'Classifique cada item em exatamente uma categoria: Frutas, Verduras e legumes, Laticínios, Bebidas, Carnes, Ovos ou Outros.',
                   'Responda APENAS com JSON no formato: {"itens":[{"nome":"Tomates","quantidade":5,"unidade":"un","confianca":0.8,"emoji":"🍅","categoria":"Verduras e legumes"}]}.',
                  "Unidades permitidas: un, kg, g, L, ml, pacote. Não invente itens ocultos, encobertos ou que não estejam visíveis.",
                ].join(" "),
              },
              ...data.imagens.map((imagem) => ({ type: "image" as const, image: imagem })),
            ],
          },
        ],
      });

      const texto = await resultado.text;
      const json = extrairJson(texto) as {
          itens?: Array<{ nome?: string; quantidade?: number; unidade?: string; confianca?: number; emoji?: string; categoria?: string }>;
      };
      const itens = (json.itens ?? [])
        .filter((i) => typeof i.nome === "string" && i.nome.trim().length > 0)
        .map((i) => ({
          nome: String(i.nome).trim(),
          quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
          unidade: typeof i.unidade === "string" ? i.unidade : "un",
          confianca: typeof i.confianca === "number" ? i.confianca : undefined,
          emoji: typeof i.emoji === "string" ? i.emoji.trim() : undefined,
           categoria: typeof i.categoria === "string" ? i.categoria.trim() : undefined,
        }));
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
      const provedor = criarProvedor();
      const local = data.local?.trim() || "Brasil (média nacional)";
      const resultado = streamText({
        model: provedor.responses(MODELO),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
        messages: [
          {
            role: "user",
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
        ],
      });

      const texto = await resultado.text;
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
