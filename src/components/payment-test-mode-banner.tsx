const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        A cobrança real ainda não está ativada neste site.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-accent bg-accent/40 px-4 py-2 text-center text-sm text-accent-foreground">
        Pagamentos nesta prévia estão em modo de teste — nenhum valor real é cobrado.
      </div>
    );
  }
  return null;
}
