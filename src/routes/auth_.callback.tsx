import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSessao } from "@/lib/use-sessao";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { authHead } from "@/lib/auth-head";

export const Route = createFileRoute("/auth_/callback")({
  head: () => authHead("Confirmar acesso", "Confirmação segura do acesso à sua conta da Geladeira Inteligente."),
  component: Callback,
});

function Callback() {
  const { usuario, pronto } = useSessao();
  const navigate = useNavigate();
  const started = useRef(false);
  const [mensagem, setMensagem] = useState("Estamos verificando sua compra e seu e-mail…");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("error") || new URLSearchParams(window.location.search).has("error")) {
      setErro(true);
      setMensagem("O login do Google não foi concluído. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    if (!pronto || !usuario || started.current || erro) return;
    started.current = true;

    void (async () => {
      const { data: acesso, error: acessoError } = await supabase.rpc("tem_acesso_pago");
      if (!acessoError && acesso) {
        await navigate({ to: "/", replace: true });
        return;
      }

      const { error: envioError } = await supabase.functions.invoke("request-email-confirmation", {
        method: "POST",
      });

      if (envioError) {
        setErro(true);
        setMensagem(envioError.message || "Não foi possível confirmar a compra para este e-mail. Verifique se o Google usa o mesmo e-mail informado na Cakto.");
        return;
      }
      setMensagem("Enviamos um link de confirmação para o e-mail da compra. Abra a mensagem e clique em “Confirmar meu e-mail”. O link expira em 30 minutos.");
    })();
  }, [usuario, pronto, erro, navigate]);

  return (
    <AuthLayout titulo="Confirmando acesso" subtitulo="A liberação depende de uma compra aprovada, do e-mail correspondente e de um período de acesso válido.">
      <p role="status" className="text-sm leading-relaxed">{mensagem}</p>
      <Button asChild variant="outline"><Link to="/oferta">Ver planos</Link></Button>
      {erro && <Button asChild><Link to="/auth">Tentar novamente</Link></Button>}
    </AuthLayout>
  );
}
