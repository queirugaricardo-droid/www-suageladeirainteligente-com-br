CREATE OR REPLACE FUNCTION public.catalogar_estoque_ideal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF length(btrim(NEW.nome)) BETWEEN 1 AND 120 THEN
  INSERT INTO public.catalogo_alimentos(user_id, nome, categoria, unidade, emoji, origem)
  VALUES(NEW.user_id, btrim(NEW.nome), NEW.categoria, NEW.unidade, NEW.emoji, 'estoque_ideal')
  ON CONFLICT(user_id, chave_nome) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.catalogar_estoque_ideal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogar_estoque_ideal() TO authenticated, service_role;
CREATE TRIGGER catalogar_alimento_ideal AFTER INSERT OR UPDATE OF nome, categoria, unidade ON public.estoque_ideal FOR EACH ROW EXECUTE FUNCTION public.catalogar_estoque_ideal();
CREATE OR REPLACE FUNCTION public.atualizar_data_catalogo()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER catalogo_data_atualizacao BEFORE UPDATE ON public.catalogo_alimentos FOR EACH ROW EXECUTE FUNCTION public.atualizar_data_catalogo();