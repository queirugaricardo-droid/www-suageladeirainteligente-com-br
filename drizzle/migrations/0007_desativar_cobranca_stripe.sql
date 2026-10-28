CREATE OR REPLACE FUNCTION public.tem_acesso_pago()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT false; $$;
CREATE OR REPLACE FUNCTION public.tem_acesso_pago_ambiente(p_ambiente text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT false; $$;
COMMENT ON FUNCTION public.tem_acesso_pago() IS 'DEPRECATED: billing removed; paid access is always disabled.';
COMMENT ON FUNCTION public.tem_acesso_pago_ambiente(text) IS 'DEPRECATED: billing removed; paid access is always disabled in every environment.';
COMMENT ON TABLE public.assinaturas IS 'DEPRECATED: archived subscription records preserved after billing removal; not used by the application.';
CREATE OR REPLACE FUNCTION public.criar_conta_aplicativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles(id,nome_completo,termos_versao,termos_aceitos_em)
 VALUES(NEW.id, left(coalesce(NEW.raw_user_meta_data->>'nome_completo',NEW.raw_user_meta_data->>'full_name',''),120),
 CASE WHEN NEW.raw_user_meta_data->>'termos_aceitos' = 'true' THEN '2026-10-24' ELSE NULL END,
 CASE WHEN NEW.raw_user_meta_data->>'termos_aceitos' = 'true' THEN now() ELSE NULL END)
 ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.criar_conta_aplicativo() FROM PUBLIC, anon, authenticated;