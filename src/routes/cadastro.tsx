import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cadastroSchema, mensagemAuth } from "@/lib/auth-validation";
import { authHead } from "@/lib/auth-head";

export const Route = createFileRoute("/cadastro")({ head: () => authHead("Criar conta", "Crie sua conta pessoal e mantenha seus alimentos e análises protegidos."), component: Cadastro });
function Cadastro() {
  const [nome, setNome] = useState(""); const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [confirmar, setConfirmar] = useState(""); const [termos, setTermos] = useState(false); const [busy, setBusy] = useState(false); const [erro, setErro] = useState(""); const [enviado, setEnviado] = useState(false);
  return <AuthLayout titulo={enviado ? "Confira seu e-mail" : "Crie sua conta"} subtitulo={enviado ? "Confirme seu endereço para começar a usar a Geladeira Inteligente." : "Seu estoque, catálogo e análises em uma única conta."}>
    {enviado ? <div role="status" className="space-y-4"><CheckCircle2 className="size-10 text-primary" /><p className="text-sm leading-relaxed">Se o endereço puder ser cadastrado, você receberá um link de confirmação. Se já tem conta, entre ou recupere sua senha. Confira também a caixa de spam.</p><Button asChild className="w-full"><Link to="/auth">Ir para o login</Link></Button></div> : <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setErro(""); const valid = cadastroSchema.safeParse({ nome, email, senha, confirmar, termos }); if (!valid.success) { setErro(valid.error.issues[0]?.message ?? "Confira os campos."); return; } setBusy(true); try { const { error } = await supabase.auth.signUp({ email: valid.data.email, password: valid.data.senha, options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { nome_completo: valid.data.nome, termos_aceitos: true } } }); if (error) throw error; setSenha(""); setConfirmar(""); setEnviado(true); } catch (err) { setErro(mensagemAuth(err)); } finally { setBusy(false); } }}>
      <div className="space-y-2"><Label htmlFor="nome-completo">Nome completo</Label><Input id="nome-completo" required autoComplete="name" maxLength={120} value={nome} onChange={e => setNome(e.target.value)} className="h-11" /></div>
      <div className="space-y-2"><Label htmlFor="cadastro-email">E-mail</Label><Input id="cadastro-email" required type="email" autoComplete="email" maxLength={255} value={email} onChange={e => setEmail(e.target.value)} className="h-11" /></div>
      <PasswordInput id="cadastro-senha" label="Senha" value={senha} onChange={setSenha} /><p className="text-xs text-muted-foreground">Pelo menos 8 caracteres. Evite senhas já utilizadas.</p><PasswordInput id="cadastro-confirmar" label="Confirmar senha" value={confirmar} onChange={setConfirmar} />
      <div className="flex items-start gap-3"><Checkbox id="aceitar-termos" checked={termos} onCheckedChange={v => setTermos(v === true)} /><Label htmlFor="aceitar-termos" className="block text-sm leading-relaxed">Li e aceito os <Link to="/termos" className="text-primary underline">Termos de Uso</Link> e a <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.</Label></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<Button type="submit" className="h-11 w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Criando conta…" : "Criar minha conta"}</Button>
    </form>}
    <p className="text-center text-sm text-muted-foreground">Já tem conta? <Link to="/auth" className="font-semibold text-primary">Entrar</Link></p>
  </AuthLayout>;
}