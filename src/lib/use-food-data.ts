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
    if (!userId) return;
    const { error } = await supabase.rpc("salvar_analise_confirmada", { p_id: id, p_relatorio: prepararRelatorioConfirmado(relatorio) });
    if (error) throw error;
    await Promise.all([client.invalidateQueries({ queryKey: catalogKey }), client.invalidateQueries({ queryKey: historyKey })]);
  }

  return { usuario, catalogo, historico, salvarAlimento, confirmarAnalise };
}