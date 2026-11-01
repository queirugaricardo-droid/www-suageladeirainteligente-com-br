
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, mensagemAuth } from "@/lib/auth-validation";
import { useSessao } from "@/lib/use-sessao";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Geladeira Inteligente" },
      {
        name: "description",
        content: "Entre na sua conta da Geladeira Inteligente para analisar fotos da sua geladeira.",
      },
      { property: "og:title", content: "Entrar — Geladeira Inteligente" },
      {
        property: "og:description",
        content: "Acesse sua conta para usar a análise por foto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaAuth,
});

function PaginaAuth() {
  const navigate = useNavigate();
  const { usuario, pronto } = useSessao();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (pronto && usuario) {
      void navigate({ to: "/conta", replace: true });
    }
  }, [usuario, pronto, navigate]);

  const enviar = async (e: import("react").FormEvent) => {
    e.preventDefault();
    setErro("");

    const valid = loginSchema.safeParse({ email, senha });

    if (!valid.success) {
      setErro(valid.error.issues[0]?.message ?? "Confira os dados.");
      return;
    }

    setCarregando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: valid.data.email,
        password: valid.data.senha,
      });

      if (error) throw error;

      await navigate({ to: "/conta", replace: true });
    } catch (err) {
      setErro(mensagemAuth(err));
    } finally {
      setCarregando(false);
    }
  };

  const entrarComGoogle = async () => {
    setCarregando(true);
    setErro("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setErro(mensagemAuth(err));
      setCarregando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Bem-vindo de volta"
      subtitulo="Entre para acessar seu estoque e histórico de análises."
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={carregando}
        onClick={() => void entrarComGoogle()}
      >
        {carregando && <Loader2 className="size-4 animate-spin" />}
        Continuar com Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou entre com e-mail
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={enviar} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            autoComplete="email"
            required
          />
        </div>

        <PasswordInput
          id="login-senha"
          label="Senha"
          autoComplete="current-password"
          value={senha}
          onChange={setSenha}
        />

        <Link
          to="/recuperar-senha"
          className="block text-right text-sm text-primary"
        >
          Esqueci minha senha
        </Link>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando && <Loader2 className="size-4 animate-spin" />}
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link to="/cadastro" className="font-semibold text-primary">
          Criar agora
        </Link>
      </p>
    </AuthLayout>
  );
}
