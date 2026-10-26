import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultarConta } from "@/lib/account.functions";
import { authHead } from "@/lib/auth-head";

export const Route = createFileRoute("/_authenticated/assinatura-retorno")({
  head: () => authHead("Confirmando assinatura", "Confirmação da assinatura do plano mensal da Geladeira Inteligente."),
  component: Retorno,
});

// Access is shown only after the server-verified webhook updated the account.
function Retorno() {
  const [inicio] = useState(() => Date.now());
  const consultar = useServerFn(consultarConta);
  const conta = useQuery({
    queryKey: ["conta-retorno"],
    queryFn: () => consultar(),
    refetchInterval: (q) => (q.state.data?.acessoPago || q.state.dataUpdatedAt - inicio > 60_000 ? false : 3000),
  });
  const pago = conta.data?.acessoPago;
  const esgotado = Date.now() - inicio > 60_000 && conta.dataUpdatedAt - inicio > 60_000;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      {pago ? (
        <>
          <CheckCircle2 className="size-12 text-primary" />
          <h1 className="text-2xl font-bold">Assinatura confirmada!</h1>
          <p className="text-muted-foreground">Seu limite continua sendo de 2 fotos por mês. A assinatura não reinicia as fotos já usadas.</p>
          <Button asChild><Link to="/">Escanear minha geladeira</Link></Button>
        </>
      ) : conta.data && esgotado ? (
        <>
          <h1 className="text-2xl font-bold">Ainda estamos confirmando</h1>
          <p className="text-muted-foreground">O pagamento pode levar alguns minutos para ser confirmado. Confira em Minha conta.</p>
          <Button asChild variant="outline"><Link to="/conta">Minha conta</Link></Button>
        </>
      ) : (
        <>
          <Loader2 className="size-10 animate-spin text-primary" />
          <h1 className="text-2xl font-bold">Confirmando seu pagamento…</h1>
          <p className="text-muted-foreground">Isso leva só alguns segundos.</p>
        </>
      )}
    </main>
  );
}
