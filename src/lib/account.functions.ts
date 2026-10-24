import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarConta = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [perfil, assinatura, pago] = await Promise.all([
    context.supabase.from("profiles").select("nome_completo, termos_aceitos_em, termos_versao").eq("id", context.userId).single(),
    context.supabase.from("assinaturas").select("plano, status, acesso_inicio, acesso_fim, renovacao_em").eq("user_id", context.userId).single(),
    context.supabase.rpc("tem_acesso_pago"),
  ]);
  if (perfil.error || assinatura.error || pago.error) throw new Error("Não foi possível carregar sua conta.");
  return { perfil: perfil.data, assinatura: assinatura.data, acessoPago: pago.data === true };
});
export const aceitarTermos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ nome: z.string().trim().min(3).max(120), aceito: z.literal(true) }).parse(value))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("aceitar_termos_conta", { p_nome: data.nome, p_aceito: data.aceito });
    if (error) throw new Error("Não foi possível salvar seu perfil.");
    return { ok: true };
  });
// Use this guard in each future paid feature handler, never just in its UI.
export const verificarAcessoExclusivo = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("tem_acesso_pago");
  if (error || data !== true) throw new Error("Seu plano não possui acesso pago confirmado.");
  return { permitido: true };
});