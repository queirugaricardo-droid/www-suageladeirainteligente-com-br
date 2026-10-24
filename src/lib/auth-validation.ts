import { z } from "zod";

export const emailSchema = z.string().trim().email("Informe um e-mail válido.").max(255);
export const passwordSchema = z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use no máximo 72 caracteres.");
export const loginSchema = z.object({ email: emailSchema, senha: z.string().min(1, "Digite sua senha.").max(72) });
export const cadastroSchema = z.object({ nome: z.string().trim().min(3, "Informe seu nome completo.").max(120), email: emailSchema, senha: passwordSchema, confirmar: z.string(), termos: z.boolean().refine(v => v, "Aceite os Termos de Uso e a Política de Privacidade.") }).refine(v => v.senha === v.confirmar, { message: "As senhas não coincidem.", path: ["confirmar"] });
export const novaSenhaSchema = z.object({ senha: passwordSchema, confirmar: z.string() }).refine(v => v.senha === v.confirmar, { message: "As senhas não coincidem.", path: ["confirmar"] });

export function mensagemAuth(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar. Confira também a caixa de spam.";
  if (code === "user_already_exists" || code === "email_exists") return "Não foi possível criar essa conta. Tente entrar ou recuperar sua senha.";
  if (code.includes("rate_limit") || code === "over_request_rate_limit") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (code === "weak_password") return "Escolha uma senha mais forte e diferente de senhas já utilizadas.";
  if (code === "same_password") return "A nova senha deve ser diferente da atual.";
  return "Não foi possível continuar. Confira os dados e tente novamente.";
}

export type AssinaturaAcesso = { plano: string; status: string; acesso_inicio: string | null; acesso_fim: string | null; provedor: string | null; provedor_assinatura_id: string | null; pagamento_verificado_em: string | null };
export function possuiAcessoPago(s: AssinaturaAcesso | null, agora = Date.now()) {
  return Boolean(s && s.plano !== "gratuito" && ["ativo", "cancelado"].includes(s.status) && s.provedor && s.provedor_assinatura_id && s.pagamento_verificado_em && s.acesso_inicio && s.acesso_fim && Date.parse(s.acesso_inicio) <= agora && Date.parse(s.acesso_fim) > agora);
}

export const statusAssinatura: Record<string, string> = { gratuito: "Gratuito", aguardando_confirmacao: "Aguardando confirmação", ativo: "Ativo", cancelado: "Cancelado", expirado: "Expirado", pagamento_pendente: "Pagamento pendente" };