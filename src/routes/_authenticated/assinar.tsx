import { useCallback, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Refrigerator, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { criarCheckoutPlano } from "@/lib/payments.functions";
import { getStripe } from "@/lib/stripe";
import { authHead } from "@/lib/auth-head";

export const Route = createFileRoute("/_authenticated/assinar")({
  head: () => authHead("Assinar plano mensal", "Assine o plano mensal da Geladeira Inteligente por R$ 19,90 e tenha 50 fotos por mês."),
  component: Assinar,
});

function Assinar() {
  const criar = useServerFn(criarCheckoutPlano);
  const [erro, setErro] = useState("");
  const fetchClientSecret = useCallback(async () => {
    try {
      const r = await criar({ data: { returnUrl: `${window.location.origin}/assinatura-retorno?session_id={CHECKOUT_SESSION_ID}` } });
      if ("error" in r) throw new Error(r.error);
      if (!r.clientSecret) throw new Error("Não foi possível iniciar o pagamento.");
      return r.clientSecret;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
      throw e;
    }
  }, [criar]);
  let stripe: ReturnType<typeof getStripe> | null = null;
  try { stripe = getStripe(); } catch (e) { if (!erro) setErro(e instanceof Error ? e.message : "Cobrança indisponível."); }

  return (
    <>
      <PaymentTestModeBanner />
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary"><Refrigerator /> Geladeira Inteligente</Link>
          <Button asChild variant="ghost"><Link to="/conta">Minha conta</Link></Button>
        </header>
        <h1 className="text-3xl font-bold">Plano mensal</h1>
        <p className="mt-2 text-lg"><strong>R$ 19,90</strong>/mês · cancele quando quiser</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {["50 fotos por mês (gratuito: 2)", "Análise dos alimentos com IA", "Lista de compras e estoque ideal", "Histórico das análises"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="size-4 text-primary" />{t}</li>
          ))}
        </ul>
        {erro ? (
          <div role="alert" className="mt-8 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
            {erro} <Link to="/conta" className="underline">Voltar para minha conta</Link>
          </div>
        ) : stripe ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card" id="checkout">
            <EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : null}
      </main>
    </>
  );
}
