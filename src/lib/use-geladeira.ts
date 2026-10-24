import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chaveDaConta, lerRelatorioSeguro } from "./food-data";
import type { ItemIdeal, Relatorio } from "./fridge-types";
import { useSessao } from "./use-sessao";

const CHAVE_ESTOQUE = "geladeira:estoque";
const CHAVE_RELATORIO = "geladeira:relatorio";

function ler<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

type LinhaEstoque = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  categoria: string;
  emoji: string | null;
};

function paraItem(linha: LinhaEstoque): ItemIdeal {
  return {
    id: linha.id,
    nome: linha.nome,
    quantidade: Number(linha.quantidade),
    unidade: linha.unidade as ItemIdeal["unidade"],
    categoria: linha.categoria as ItemIdeal["categoria"],
    emoji: linha.emoji ?? undefined,
  };
}

export function useGeladeira() {
  const { usuario, pronto: sessaoPronta } = useSessao();
  const [pronto, setPronto] = useState(false);
  const [estoque, setEstoque] = useState<ItemIdeal[]>([]);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const usuarioId = usuario?.id ?? null;
  const [contaCarregada, setContaCarregada] = useState<string | null | undefined>(undefined);
  const chaveEstoque = chaveDaConta(CHAVE_ESTOQUE, usuarioId);
  const chaveRelatorio = chaveDaConta(CHAVE_RELATORIO, usuarioId);

  // Carga inicial: localStorage sempre; banco quando houver sessão.
  useEffect(() => {
    if (!sessaoPronta) return;
    let ativo = true;
    setPronto(false);
    setEstoque([]);
    setRelatorio(null);

    async function carregar() {
      const local = ler<ItemIdeal[]>(chaveEstoque, []);
      if (usuarioId) {
        const { data, error } = await supabase
          .from("estoque_ideal")
          .select("id, nome, quantidade, unidade, categoria, emoji")
          .eq("user_id", usuarioId)
          .order("created_at", { ascending: true });
        if (!ativo) return;
        if (!error && data) {
          if (data.length > 0) {
            setEstoque(data.map(paraItem));
          } else if (local.length > 0) {
            // Primeira vez logado: migra o estoque local para a conta.
            const linhas = local.map((i) => ({
              nome: i.nome,
              quantidade: i.quantidade,
              unidade: i.unidade,
              categoria: i.categoria,
              emoji: i.emoji ?? null,
            }));
            const { data: inseridos } = await supabase
              .from("estoque_ideal")
              .upsert(linhas, { onConflict: "user_id,nome" })
              .select("id, nome, quantidade, unidade, categoria, emoji");
            if (!ativo) return;
            if (inseridos && inseridos.length > 0) setEstoque(inseridos.map(paraItem));
            else setEstoque(local);
          } else {
            setEstoque(local);
          }
        } else {
          setEstoque(local);
        }
      } else if (!usuarioId) {
        setEstoque(local);
      }
      if (!ativo) return;
      const { data: anteriores, error: erroHistorico } = usuarioId
        ? await supabase.from("historico_analises").select("relatorio").eq("user_id", usuarioId).order("created_at", { ascending: false }).limit(1)
        : { data: null, error: null };
      if (!ativo) return;
      setRelatorio(lerRelatorioSeguro(anteriores?.[0]?.relatorio ?? ler<Relatorio | null>(chaveRelatorio, null)));
      if (erroHistorico) console.warn("Não foi possível carregar o último relatório da conta.");
      setContaCarregada(usuarioId);
      setPronto(true);
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [sessaoPronta, usuarioId, chaveEstoque, chaveRelatorio]);

  // Espelho local (offline / deslogado).
  useEffect(() => {
    if (pronto && contaCarregada === usuarioId) window.localStorage.setItem(chaveEstoque, JSON.stringify(estoque));
  }, [estoque, pronto, contaCarregada, usuarioId, chaveEstoque]);

  useEffect(() => {
    if (!pronto || contaCarregada !== usuarioId) return;
    if (relatorio) window.localStorage.setItem(chaveRelatorio, JSON.stringify(relatorio));
    else window.localStorage.removeItem(chaveRelatorio);
  }, [relatorio, pronto, contaCarregada, usuarioId, chaveRelatorio]);

  const adicionar = useCallback(
    (item: Omit<ItemIdeal, "id">) => {
      const provisorio = { ...item, id: crypto.randomUUID() };
      setEstoque((atual) => [...atual, provisorio]);
      if (usuarioId) {
        void supabase
          .from("estoque_ideal")
          .upsert(
            {
              nome: item.nome,
              quantidade: item.quantidade,
              unidade: item.unidade,
              categoria: item.categoria,
              emoji: item.emoji ?? null,
            },
            { onConflict: "user_id,nome" },
          )
          .select("id")
          .single()
          .then(({ data }) => {
            if (data?.id) {
              setEstoque((atual) =>
                atual.map((i) => (i.id === provisorio.id ? { ...i, id: data.id } : i)),
              );
            }
          });
      }
    },
    [usuarioId],
  );

  const atualizar = useCallback(
    (id: string, mudancas: Partial<ItemIdeal>) => {
      setEstoque((atual) => {
        const novo = atual.map((i) => (i.id === id ? { ...i, ...mudancas } : i));
        if (usuarioId) {
          const item = novo.find((i) => i.id === id);
          if (item) {
            void supabase
              .from("estoque_ideal")
              .update({
                nome: item.nome,
                quantidade: item.quantidade,
                unidade: item.unidade,
                categoria: item.categoria,
                emoji: item.emoji ?? null,
              })
              .eq("id", id);
          }
        }
        return novo;
      });
    },
    [usuarioId],
  );

  const remover = useCallback(
    (id: string) => {
      setEstoque((atual) => atual.filter((i) => i.id !== id));
      if (usuarioId) void supabase.from("estoque_ideal").delete().eq("id", id);
    },
    [usuarioId],
  );

  return { pronto, estoque, relatorio, setRelatorio, adicionar, atualizar, remover };
}
