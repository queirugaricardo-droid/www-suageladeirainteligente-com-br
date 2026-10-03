import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Geladeira Inteligente" },
      { name: "description", content: "Entre na sua conta da Geladeira Inteligente para analisar fotos da sua geladeira." },
      { property: "og:title", content: "Entrar — Geladeira Inteligente" },
      { property: "og:description", content: "Acesse sua conta para usar a análise por foto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaAuth,
});

function PaginaAuth() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || senha.length < 6) {
      toast.error("Informe um e-mail válido e senha com pelo menos 6 caracteres.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
        setModo("entrar");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos." : msg || "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error("Não foi possível entrar com Google.");
    if (r.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{modo === "entrar" ? "Entrar" : "Criar conta"}</CardTitle>
          <p className="text-sm text-muted-foreground">Cada conta pode analisar até 2 fotos por mês.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={google}>
            Continuar com Google
          </Button>
          <form onSubmit={enviar} className="space-y-3">
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              required
            />
            <input
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              value={senha}
              maxLength={72}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              required
            />
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando && <Loader2 className="size-4 animate-spin" />}
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <button
            type="button"
            className="w-full text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          >
            {modo === "entrar" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
          <Link to="/" className="block text-center text-sm text-muted-foreground">
            Voltar ao início
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
