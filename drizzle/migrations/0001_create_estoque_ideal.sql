CREATE TABLE public.estoque_ideal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'un',
  categoria text NOT NULL DEFAULT 'Outros',
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_ideal TO authenticated;
GRANT ALL ON public.estoque_ideal TO service_role;

ALTER TABLE public.estoque_ideal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver proprio estoque" ON public.estoque_ideal
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "inserir proprio estoque" ON public.estoque_ideal
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "atualizar proprio estoque" ON public.estoque_ideal
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "remover proprio estoque" ON public.estoque_ideal
  FOR DELETE TO authenticated USING (auth.uid() = user_id);