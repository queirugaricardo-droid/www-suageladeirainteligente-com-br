ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS ambiente text CHECK (ambiente IS NULL OR ambiente IN ('sandbox','live'));
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS provedor_cliente_id text;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS cancelar_no_fim boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.tem_acesso_pago_ambiente(p_ambiente text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.assinaturas
 WHERE user_id = auth.uid() AND ambiente = p_ambiente AND plano <> 'gratuito' AND status IN ('ativo','cancelado','pagamento_pendente')
 AND pagamento_verificado_em IS NOT NULL AND provedor IS NOT NULL AND provedor_assinatura_id IS NOT NULL
 AND acesso_inicio <= now() AND acesso_fim > now());
$$;
REVOKE ALL ON FUNCTION public.tem_acesso_pago_ambiente(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_acesso_pago_ambiente(text) TO authenticated, service_role;
COMMENT ON TABLE public.assinaturas IS 'Read-only for customers. Updated only by the signature-verified Stripe webhook, which re-reads the subscription from Stripe.';