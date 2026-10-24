import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, createStripeClient, verifyWebhook } from "@/lib/stripe.server";
import { PLANO_PAGO, statusDaAssinatura } from "@/lib/plano";

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// Re-reads the subscription from Stripe so out-of-order or replayed events
// always write the provider's current state.
async function sincronizarAssinatura(subscriptionId: string, env: StripeEnv) {
  const stripe = createStripeClient(env);
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  // Bind only through the server-created Customer mapping.
  const userId = !("deleted" in customer && customer.deleted) ? customer.metadata?.["userId"] : undefined;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || sub.metadata?.["userId"] !== userId) {
    console.error("Assinatura sem vínculo de usuário confiável", sub.id);
    return;
  }
  const item = sub.items.data[0] as any;
  const inicio = iso(item?.current_period_start ?? (sub as any).current_period_start);
  const fim = iso(item?.current_period_end ?? (sub as any).current_period_end);
  const status = statusDaAssinatura(sub.status, sub.cancel_at_period_end);
  const pago = ["ativo", "cancelado", "pagamento_pendente"].includes(status) && sub.status !== "canceled";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("assinaturas").upsert({
    user_id: userId,
    plano: sub.status === "canceled" || sub.status === "incomplete_expired" ? "gratuito" : PLANO_PAGO,
    status: sub.status === "canceled" && !(fim && Date.parse(fim) > Date.now()) ? "expirado" : status,
    provedor: "stripe",
    provedor_assinatura_id: sub.id,
    provedor_cliente_id: customerId,
    transacao_id: typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id ?? null,
    ambiente: env,
    acesso_inicio: inicio,
    acesso_fim: fim,
    renovacao_em: sub.cancel_at_period_end || sub.status === "canceled" ? null : fim,
    cancelar_no_fim: sub.cancel_at_period_end,
    pagamento_verificado_em: pago ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(`Falha ao salvar assinatura: ${error.message}`);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        const env: StripeEnv = rawEnv;
        let event;
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("Webhook rejeitado:", e);
          return new Response("Invalid signature", { status: 400 });
        }
        try {
          const obj = event.data.object;
          let subId: string | undefined;
          if (event.type.startsWith("customer.subscription.")) subId = obj.id;
          else if (event.type.startsWith("checkout.session.")) subId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
          else if (event.type.startsWith("invoice.")) {
            const s = obj.parent?.subscription_details?.subscription ?? obj.subscription;
            subId = typeof s === "string" ? s : s?.id;
          }
          if (subId) await sincronizarAssinatura(subId, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Erro no webhook:", e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
