// Pure plan rules shared by server and client.
export const LIMITE_FOTOS_GRATUITO = 2;
export const LIMITE_FOTOS_PAGO = 50;
export const PRECO_PLANO_ID = "plano_mensal_brl";
export const PLANO_PAGO = "mensal";

export type AmbientePagamento = "sandbox" | "live";

export function limiteFotos(acessoPago: boolean) {
  return acessoPago ? LIMITE_FOTOS_PAGO : LIMITE_FOTOS_GRATUITO;
}

/** Ambiente from the build's publishable token prefix; never defaults to live. */
export function ambienteDoToken(token: string | undefined): AmbientePagamento | null {
  if (token?.startsWith("pk_test_")) return "sandbox";
  if (token?.startsWith("pk_live_")) return "live";
  return null;
}

/** Maps a Stripe subscription status to the app's assinatura status. */
export function statusDaAssinatura(stripeStatus: string, cancelarNoFim: boolean): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return cancelarNoFim ? "cancelado" : "ativo";
    case "past_due":
      return "pagamento_pendente";
    case "incomplete":
      return "aguardando_confirmacao";
    case "canceled":
      return "cancelado";
    default:
      return "expirado"; // unpaid, incomplete_expired, paused
  }
}
