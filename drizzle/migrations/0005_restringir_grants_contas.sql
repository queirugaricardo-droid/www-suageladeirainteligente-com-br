REVOKE ALL ON public.assinaturas FROM anon, authenticated;
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(nome_completo) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
COMMENT ON FUNCTION public.aceitar_termos_conta(text, boolean) IS 'Intentionally callable by authenticated customers; security definer updates only auth.uid() profile consent after explicit acceptance and name validation.';