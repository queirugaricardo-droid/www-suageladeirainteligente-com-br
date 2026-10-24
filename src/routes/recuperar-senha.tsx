import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema, mensagemAuth } from "@/lib/auth-validation";
import { authHead } from "@/lib/auth-head";
export const Route = createFileRoute("/recuperar-senha")({ head: () => authHead("Recuperar senha", "Receba um link seguro para redefinir a senha da sua conta."), component: Recuperar });
function Recuperar() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [erro, setErro] = useState(""); const [enviado, setEnviado] = useState(false);
  return <AuthLayout titulo="Recuperar senha" subtitulo="Enviaremos um link para você definir uma nova senha."><form className="space-y-4" onSubmit={async e => { e.preventDefault(); setErro(""); const valid = emailSchema.safeParse(email); if (!valid.success) { setErro("Informe um e-mail válido."); return; } setBusy(true); try { const { error } = await supabase.auth.resetPasswordForEmail(valid.data, { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error; setEnviado(true); } catch (err) { setErro(mensagemAuth(err)); } finally { setBusy(false); } }}><div className="space-y-2"><Label htmlFor="recuperar-email">E-mail</Label><Input id="recuperar-email" type="email" required maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11" /></div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}{enviado && <p role="status" className="text-sm text-primary">Se houver uma conta com esse e-mail, você receberá as instruções. Confira a caixa de spam.</p>}<Button disabled={busy} className="h-11 w-full">{busy ? "Enviando…" : "Enviar link de recuperação"}</Button></form><Link to="/auth" className="block text-center text-sm text-primary">Voltar ao login</Link></AuthLayout>;
}