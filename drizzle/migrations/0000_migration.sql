CREATE TABLE public.analises_foto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  fotos integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analises_foto TO authenticated;
GRANT ALL ON public.analises_foto TO service_role;
ALTER TABLE public.analises_foto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver proprias analises" ON public.analises_foto FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "registrar proprias analises" ON public.analises_foto FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX analises_foto_user_mes ON public.analises_foto (user_id, created_at);