import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/use-sessao";
import { useSignOut } from "@/lib/use-sign-out";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { novaSenhaSchema, mensagemAuth } from "@/lib/auth-validation";
import { authHead } from "@/lib/auth-head";
export const Route = createFileRoute("/reset-password")({ head: () => authHead("Definir nova senha", "Redefina sua senha usando o link seguro recebido por e-mail."), component: Reset });
function Reset() {
  const { usuario, pronto } = useSessao(); const sair = useSignOut(); const [recovery, setRecovery] = useState(false); const [senha, setSenha] = useState(""); const [confirmar, setConfirmar] = useState(""); const [erro, setErro] = useState(""); const [busy, setBusy] = useState(false); const [feito, setFeito] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const params = new URLSearchParams(window.location.search);
    // Capture recovery intent before Cloud Auth clears the URL hash.
    setRecovery(hash.get("type") === "recovery" || params.get("type") === "recovery" || sessionStorage.getItem("geladeira:recovery") === "true");
    if (hash.get("type") === "recovery") sessionStorage.setItem("geladeira:recovery", "true");
  }, []);
  return <AuthLayout titulo={feito ? "Senha atualizada" : "Definir nova senha"} subtitulo="Use uma senha forte e diferente das anteriores.">{!pronto ? <p role="status">Verificando link…</p> : feito ? <Button className="w-full" onClick={() => void sair()}>Entrar com a nova senha</Button> : !recovery || !usuario ? <div className="space-y-4"><p role="alert">Este link é inválido ou expirou. Solicite um novo link de recuperação.</p><Button asChild><Link to="/recuperar-senha">Solicitar novo link</Link></Button></div> : <form className="space-y-4" onSubmit={async e => { e.preventDefault(); const valid = novaSenhaSchema.safeParse({ senha, confirmar }); if (!valid.success) { setErro(valid.error.issues[0]?.message ?? "Confira a senha."); return; } setBusy(true); setErro(""); try { const { error } = await supabase.auth.updateUser({ password: valid.data.senha }); if (error) throw error; sessionStorage.removeItem("geladeira:recovery"); setSenha(""); setConfirmar(""); setFeito(true); } catch (err) { setErro(mensagemAuth(err)); } finally { setBusy(false); } }}><PasswordInput id="reset-senha" label="Nova senha" value={senha} onChange={setSenha} /><PasswordInput id="reset-confirmar" label="Confirmar nova senha" value={confirmar} onChange={setConfirmar} />{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<Button disabled={busy} className="h-11 w-full">{busy ? "Atualizando…" : "Salvar nova senha"}</Button></form>}</AuthLayout>;
}