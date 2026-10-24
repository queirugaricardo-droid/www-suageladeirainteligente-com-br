import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { ambienteDoToken, PRECO_PLANO_ID } from "@/lib/plano";

// The environment comes from this build's token, never from the browser.
function ambienteServidor() {
  const env = ambienteDoToken(import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined);
  if (!env) throw new Error("A cobrança ainda não está ativada nesta versão do site.");
  return env;
}

type Stripe = ReturnType<typeof createStripeClient>;

async function resolverCliente(stripe: Stripe, userId: string, email?: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
  if (found.data.length) return found.data[0].id;
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== userId) await stripe.customers.update(c.id, { metadata: { ...c.metadata, userId } });
      return c.id;
    }
  }
  const created = await stripe.customers.create({ ...(email && { email }), metadata: { userId } });
  return created.id;
}

export const criarCheckoutPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string }) => {
    const url = new URL(data.returnUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL inválida");
    return { returnUrl: data.returnUrl.slice(0, 500) };
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const env = ambienteServidor();
      const { data: pago } = await context.supabase.rpc("tem_acesso_pago_ambiente", { p_ambiente: env });
      if (pago === true) return { error: "Sua assinatura já está ativa." };
      const email = typeof context.claims?.email === "string" ? context.claims.email : undefined;
      const stripe = createStripeClient(env);
      const prices = await stripe.prices.list({ lookup_keys: [PRECO_PLANO_ID] });
      const price = prices.data[0];
      if (!price) throw new Error("Plano não encontrado.");
      const customer = await resolverCliente(stripe, context.userId, email);
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        locale: "pt-BR",
        return_url: data.returnUrl,
        customer,
        billing_address_collection: "required",
        customer_update: { address: "auto", name: "auto" },
        automatic_tax: { enabled: true },
        metadata: { userId: context.userId, managed_payments: "false" },
        subscription_data: { metadata: { userId: context.userId } },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const criarPortalAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string }) => ({ returnUrl: String(data.returnUrl).slice(0, 500) }))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const env = ambienteServidor();
      const { data: row } = await context.supabase.from("assinaturas").select("provedor_cliente_id, ambiente").eq("user_id", context.userId).maybeSingle();
      if (!row?.provedor_cliente_id || row.ambiente !== env) return { error: "Nenhuma assinatura encontrada." };
      const stripe = createStripeClient(env);
      const portal = await stripe.billingPortal.sessions.create({ customer: row.provedor_cliente_id, return_url: data.returnUrl });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Server-side photo allowance used by the analysis handler. */
export async function acessoPagoServidor(supabase: { rpc: (...a: any[]) => any }) {
  const env = ambienteDoToken(import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined);
  if (!env) return false;
  const { data, error } = await supabase.rpc("tem_acesso_pago_ambiente", { p_ambiente: env });
  if (error) throw new Error("Não consegui verificar seu plano.");
  return data === true;
}
