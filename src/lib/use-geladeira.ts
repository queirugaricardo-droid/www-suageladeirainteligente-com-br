import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ESTOQUE_EXEMPLO } from "./fridge-logic";
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
  const [estoque, setEstoque] = useState<ItemIdeal[]>(ESTOQUE_EXEMPLO);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const usuarioId = usuario?.id ?? null;
  const carregadoPara = useRef<string | null>(null);

  // Carga inicial: localStorage sempre; banco quando houver sessão.
  useEffect(() => {
    if (!sessaoPronta) return;
    let ativo = true;

    async function carregar() {
      const local = ler<ItemIdeal[]>(CHAVE_ESTOQUE, ESTOQUE_EXEMPLO);
      if (usuarioId && carregadoPara.current !== usuarioId) {
        carregadoPara.current = usuarioId;
        const { data, error } = await supabase
          .from("estoque_ideal")
          .select("id, nome, quantidade, unidade, categoria, emoji")
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
        carregadoPara.current = null;
        setEstoque(local);
      }
      if (!ativo) return;
      setRelatorio(ler<Relatorio | null>(CHAVE_RELATORIO, null));
      setPronto(true);
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [sessaoPronta, usuarioId]);

  // Espelho local (offline / deslogado).
  useEffect(() => {
    if (pronto) window.localStorage.setItem(CHAVE_ESTOQUE, JSON.stringify(estoque));
  }, [estoque, pronto]);

  useEffect(() => {
    if (!pronto) return;
    if (relatorio) window.localStorage.setItem(CHAVE_RELATORIO, JSON.stringify(relatorio));
    else window.localStorage.removeItem(CHAVE_RELATORIO);
  }, [relatorio, pronto]);

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
