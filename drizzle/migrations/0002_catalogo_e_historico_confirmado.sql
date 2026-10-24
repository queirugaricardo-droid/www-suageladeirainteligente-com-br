CREATE TABLE public.catalogo_alimentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 nome text NOT NULL,
 chave_nome text GENERATED ALWAYS AS (lower(btrim(nome))) STORED,
 categoria text NOT NULL DEFAULT 'Outros',
 unidade text NOT NULL DEFAULT 'un',
 emoji text,
 origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'estoque_ideal', 'analise_confirmada')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, chave_nome),
 UNIQUE(id, user_id),
 CHECK (length(btrim(nome)) BETWEEN 1 AND 120)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_alimentos TO authenticated;
GRANT ALL ON public.catalogo_alimentos TO service_role;
ALTER TABLE public.catalogo_alimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogo_proprio ON public.catalogo_alimentos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX catalogo_usuario_categoria ON public.catalogo_alimentos(user_id, categoria);

CREATE TABLE public.historico_analises (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 relatorio jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id, user_id),
 CHECK (jsonb_typeof(relatorio) = 'object')
);
GRANT SELECT, INSERT ON public.historico_analises TO authenticated;
GRANT ALL ON public.historico_analises TO service_role;
ALTER TABLE public.historico_analises ENABLE ROW LEVEL SECURITY;
CREATE POLICY historico_ler_proprio ON public.historico_analises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY historico_salvar_proprio ON public.historico_analises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX historico_usuario_data ON public.historico_analises(user_id, created_at DESC);

CREATE TABLE public.historico_analise_itens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 analise_id uuid NOT NULL,
 alimento_id uuid,
 nome text NOT NULL,
 categoria text NOT NULL DEFAULT 'Outros',
 quantidade numeric NOT NULL CHECK (quantidade >= 0),
 unidade text NOT NULL,
 confianca numeric CHECK (confianca BETWEEN 0 AND 1),
 estimado boolean NOT NULL DEFAULT false,
 emoji text,
 FOREIGN KEY (analise_id, user_id) REFERENCES public.historico_analises(id, user_id) ON DELETE CASCADE,
 FOREIGN KEY (alimento_id, user_id) REFERENCES public.catalogo_alimentos(id, user_id),
 CHECK (length(btrim(nome)) BETWEEN 1 AND 120)
);
GRANT SELECT, INSERT ON public.historico_analise_itens TO authenticated;
GRANT ALL ON public.historico_analise_itens TO service_role;
ALTER TABLE public.historico_analise_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_historico_ler ON public.historico_analise_itens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY itens_historico_salvar ON public.historico_analise_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX itens_historico_analise ON public.historico_analise_itens(analise_id);
CREATE INDEX itens_historico_alimento ON public.historico_analise_itens(alimento_id);

INSERT INTO public.catalogo_alimentos(user_id, nome, categoria, unidade, emoji, origem)
SELECT DISTINCT ON (user_id, lower(btrim(nome))) user_id, btrim(nome), categoria, unidade, emoji, 'estoque_ideal'
FROM public.estoque_ideal WHERE length(btrim(nome)) BETWEEN 1 AND 120
ORDER BY user_id, lower(btrim(nome)), created_at DESC
ON CONFLICT(user_id, chave_nome) DO NOTHING;

CREATE OR REPLACE FUNCTION public.salvar_analise_confirmada(p_id uuid, p_relatorio jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_item jsonb; v_alimento uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para salvar a análise.'; END IF;
 IF p_id IS NULL OR jsonb_typeof(p_relatorio) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_relatorio->'detectados') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_relatorio->'linhas') IS DISTINCT FROM 'array' THEN
 RAISE EXCEPTION 'Relatório inválido.';
 END IF;
 IF jsonb_array_length(p_relatorio->'detectados') NOT BETWEEN 1 AND 200 THEN
 RAISE EXCEPTION 'Confirme entre 1 e 200 alimentos.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.historico_analises WHERE id = p_id AND user_id = v_user) THEN RETURN p_id; END IF;
 INSERT INTO public.historico_analises(id, user_id, relatorio) VALUES(p_id, v_user, p_relatorio);
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_relatorio->'detectados') LOOP
  IF length(btrim(v_item->>'nome')) NOT BETWEEN 1 AND 120 OR v_item->>'nome' IS NULL
    OR v_item->>'unidade' NOT IN ('un','kg','g','L','ml','pacote') OR v_item->>'unidade' IS NULL
    OR v_item->>'quantidade' IS NULL THEN RAISE EXCEPTION 'Alimento inválido.'; END IF;
  INSERT INTO public.catalogo_alimentos(user_id, nome, categoria, unidade, emoji, origem)
  VALUES(v_user, btrim(v_item->>'nome'), coalesce(v_item->>'categoria', 'Outros'), v_item->>'unidade', v_item->>'emoji', 'analise_confirmada')
  ON CONFLICT(user_id, chave_nome) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_alimento;
  INSERT INTO public.historico_analise_itens(user_id, analise_id, alimento_id, nome, categoria, quantidade, unidade, confianca, estimado, emoji)
  VALUES(v_user, p_id, v_alimento, btrim(v_item->>'nome'), coalesce(v_item->>'categoria', 'Outros'), (v_item->>'quantidade')::numeric, v_item->>'unidade', (v_item->>'confianca')::numeric, coalesce((v_item->>'estimado')::boolean, false), v_item->>'emoji');
 END LOOP;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_analise_confirmada(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_analise_confirmada(uuid, jsonb) TO authenticated, service_role;
COMMENT ON TABLE public.historico_analises IS 'Immutable report snapshots explicitly confirmed by each user. Photo usage remains in analises_foto.';
COMMENT ON TABLE public.catalogo_alimentos IS 'Private food names and preferred units; not current inventory and not AI ground truth.';