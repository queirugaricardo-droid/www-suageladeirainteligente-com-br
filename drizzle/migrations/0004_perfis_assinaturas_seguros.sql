CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 nome_completo text NOT NULL DEFAULT '' CHECK (length(nome_completo) <= 120),
 termos_versao text,
 termos_aceitos_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(nome_completo) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY perfil_ler_proprio ON public.profiles FOR SELECT TO authenticated USING(auth.uid() = id);
CREATE POLICY perfil_editar_nome ON public.profiles FOR UPDATE TO authenticated USING(auth.uid() = id) WITH CHECK(auth.uid() = id);

CREATE TABLE public.assinaturas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE,
 plano text NOT NULL DEFAULT 'gratuito' CHECK (length(plano) BETWEEN 1 AND 80),
 status text NOT NULL DEFAULT 'gratuito' CHECK (status IN ('gratuito','aguardando_confirmacao','ativo','cancelado','expirado','pagamento_pendente')),
 acesso_inicio timestamptz,
 acesso_fim timestamptz,
 renovacao_em timestamptz,
 provedor text,
 provedor_assinatura_id text,
 transacao_id text,
 pagamento_verificado_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (acesso_fim IS NULL OR acesso_inicio IS NULL OR acesso_fim > acesso_inicio),
 CHECK (status <> 'ativo' OR (plano <> 'gratuito' AND provedor IS NOT NULL AND provedor_assinatura_id IS NOT NULL AND pagamento_verificado_em IS NOT NULL AND acesso_inicio IS NOT NULL AND acesso_fim IS NOT NULL)),
 UNIQUE(provedor, provedor_assinatura_id)
);
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_ler_propria ON public.assinaturas FOR SELECT TO authenticated USING(auth.uid() = user_id);
CREATE INDEX assinaturas_status_fim ON public.assinaturas(status, acesso_fim);

INSERT INTO public.profiles(id,nome_completo)
SELECT id, left(coalesce(raw_user_meta_data->>'nome_completo',raw_user_meta_data->>'full_name',''),120) FROM auth.users ON CONFLICT(id) DO NOTHING;
INSERT INTO public.assinaturas(user_id) SELECT id FROM auth.users ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.criar_conta_aplicativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles(id,nome_completo,termos_versao,termos_aceitos_em)
 VALUES(NEW.id, left(coalesce(NEW.raw_user_meta_data->>'nome_completo',NEW.raw_user_meta_data->>'full_name',''),120),
 CASE WHEN NEW.raw_user_meta_data->>'termos_aceitos' = 'true' THEN '2026-10-24' ELSE NULL END,
 CASE WHEN NEW.raw_user_meta_data->>'termos_aceitos' = 'true' THEN now() ELSE NULL END)
 ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.assinaturas(user_id) VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.criar_conta_aplicativo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER criar_perfil_geladeira AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.criar_conta_aplicativo();

CREATE OR REPLACE FUNCTION public.aceitar_termos_conta(p_nome text, p_aceito boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
 IF v_user IS NULL OR p_aceito IS DISTINCT FROM true OR length(btrim(p_nome)) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Informe seu nome e aceite os termos.'; END IF;
 UPDATE public.profiles SET nome_completo = btrim(p_nome), termos_versao = '2026-10-24', termos_aceitos_em = coalesce(termos_aceitos_em, now()), updated_at = now() WHERE id = v_user;
END;
$$;
REVOKE ALL ON FUNCTION public.aceitar_termos_conta(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_termos_conta(text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.tem_acesso_pago()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.assinaturas
 WHERE user_id = auth.uid() AND plano <> 'gratuito' AND status IN ('ativo','cancelado')
 AND pagamento_verificado_em IS NOT NULL AND provedor IS NOT NULL AND provedor_assinatura_id IS NOT NULL
 AND acesso_inicio <= now() AND acesso_fim > now());
$$;
REVOKE ALL ON FUNCTION public.tem_acesso_pago() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_acesso_pago() TO authenticated, service_role;
COMMENT ON TABLE public.assinaturas IS 'Read-only for customers. Only verified payment backend/webhook may change entitlements; no payment provider configured yet.';
COMMENT ON COLUMN public.profiles.termos_aceitos_em IS 'Consent recorded at signup or authenticated explicit acceptance; cannot be edited directly by customers.';