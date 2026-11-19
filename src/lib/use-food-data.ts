import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useSessao } from "./use-sessao";
import { prepararRelatorioConfirmado } from "./food-data";
import type { Relatorio } from "./fridge-types";

export type AlimentoCatalogo = Tables<"catalogo_alimentos">;
export type RegistroAnalise = Tables<"historico_analises">;
export type NovoAlimento = Pick<AlimentoCatalogo, "nome" | "categoria" | "unidade" | "emoji">;

export function useFoodData() {
  const { usuario } = useSessao();
  const client = useQueryClient();
  const userId = usuario?.id;
  const catalogKey = ["catalogo", userId];
  const historyKey = ["historico", userId];
  const catalogo = useQuery({ queryKey: catalogKey, enabled: Boolean(userId), queryFn: async () => {
    if (!userId) return [];
    const { data, error } = await supabase.from("catalogo_alimentos").select("*").eq("user_id", userId).order("nome");
    if (error) throw error;
    return data;
  } });
  const historico = useQuery({ queryKey: historyKey, enabled: Boolean(userId), queryFn: async () => {
    if (!userId) return [];
    const { data, error } = await supabase.from("historico_analises").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });

  async function salvarAlimento(item: NovoAlimento, id?: string) {
    if (!userId) throw new Error("Entre na sua conta para salvar alimentos.");
    const nome = item.nome.trim();
    if (!nome || nome.length > 120) throw new Error("Use um nome de até 120 caracteres.");
    const values = { ...item, nome, user_id: userId, updated_at: new Date().toISOString() };
    const result = id
      ? await supabase.from("catalogo_alimentos").update(values).eq("id", id).eq("user_id", userId)
      : await supabase.from("catalogo_alimentos").upsert(values, { onConflict: "user_id,chave_nome" });
    if (result.error) throw result.error;
    await client.invalidateQueries({ queryKey: catalogKey });
  }

  async function confirmarAnalise(relatorio: Relatorio, id: string) {
    if (!userId) throw new Error("Entre na sua conta para salvar a análise.");

    const relatorioSeguro = prepararRelatorioConfirmado(relatorio);

    // Prefer the database RPC because it can also persist the normalized item rows.
    const { error: rpcError } = await supabase.rpc("salvar_analise_confirmada", {
      p_id: id,
      p_relatorio: relatorioSeguro,
    });

    if (rpcError) {
      // Fallback for environments where the RPC is missing/out of sync.
      // The user-scoped row is protected by Supabase RLS and can be saved directly.
      const { error: historicoError } = await supabase
        .from("historico_analises")
        .upsert(
          {
            id,
            user_id: userId,
            relatorio: relatorioSeguro,
          },
          { onConflict: "id" },
        );

      if (historicoError) {
        const detalhes = String(rpcError.message ?? "").trim();
        throw new Error(
          detalhes
            ? `Não foi possível salvar a análise. ${detalhes}`
            : "Não foi possível salvar a análise na sua conta.",
        );
      }
    }

    await Promise.all([
      client.invalidateQueries({ queryKey: catalogKey }),
      client.invalidateQueries({ queryKey: historyKey }),
    ]);
  }

  return { usuario, catalogo, historico, salvarAlimento, confirmarAnalise };
}