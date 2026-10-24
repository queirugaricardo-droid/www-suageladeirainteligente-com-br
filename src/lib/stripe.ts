import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ambienteDoToken, type AmbientePagamento } from "./plano";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function getStripeEnvironment(): AmbientePagamento {
  const env = ambienteDoToken(clientToken);
  if (!env) throw new Error("A cobrança ainda não está ativada nesta versão do site.");
  return env;
}

let stripePromise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    getStripeEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}
