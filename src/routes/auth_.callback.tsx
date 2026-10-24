import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSessao } from "@/lib/use-sessao";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { authHead } from "@/lib/auth-head";
export const Route = createFileRoute("/auth_/callback")({ head: () => authHead("Confirmar acesso", "Confirmação segura do acesso à sua conta da Geladeira Inteligente."), component: Callback });
function Callback() {
  const { usuario, pronto } = useSessao(); const navigate = useNavigate(); const [erro, setErro] = useState(false);
  useEffect(() => { const hash = new URLSearchParams(window.location.hash.slice(1)); setErro(hash.has("error") || new URLSearchParams(window.location.search).has("error")); }, []);
  useEffect(() => { if (pronto && usuario && !erro) void navigate({ to: "/conta", replace: true }); }, [usuario, pronto, erro, navigate]);
  return <AuthLayout titulo="Confirmando acesso" subtitulo="Estamos verificando sua conta.">{!pronto ? <p role="status">Aguarde…</p> : <><p>{erro ? "O link é inválido ou expirou." : "Se você confirmou seu e-mail, entre para acessar sua conta."}</p><Button asChild><Link to="/auth">Ir para o login</Link></Button></>}</AuthLayout>;
}