import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { authHead } from "@/lib/auth-head";

export const Route = createFileRoute("/confirmar-email")({
  head: () => authHead("Confirmar e-mail", "Confirmação segura do e-mail da compra."),
  component: ConfirmarEmail,
});

function ConfirmarEmail() {
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState("Validando seu link de confirmação…");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setMensagem("O link está incompleto ou não é válido.");
      return;
    }

    void (async () => {
      const { data, error } = await supabase.functions.invoke("confirm-email", {
        method: "POST",
        body: { token },
      });
      if (error || !data?.confirmed) {
        setMensagem(data?.error || error?.message || "Este link expirou ou não é mais válido. Solicite uma nova confirmação.");
        return;
      }
      setSucesso(true);
      const { data: { user } } = await supabase.auth.getUser();
      setMensagem(user
        ? "E-mail confirmado! Estamos verificando os 30 dias de acesso."
        : "E-mail confirmado! Entre com a mesma conta Google usada na compra para acessar o aplicativo.");
      if (user) {
        window.setTimeout(() => void navigate({ to: "/", replace: true }), 900);
      }
    })();
  }, [navigate]);

  return (
    <AuthLayout titulo="Confirmação de e-mail" subtitulo="A confirmação é vinculada ao pagamento e ao e-mail da compra.">
      <p role="status" className="text-sm leading-relaxed">{mensagem}</p>
      {sucesso
        ? <Button asChild><Link to="/auth">Entrar no aplicativo</Link></Button>
        : <Button asChild variant="outline"><Link to="/auth">Voltar ao login</Link></Button>}
    </AuthLayout>
  );
}
