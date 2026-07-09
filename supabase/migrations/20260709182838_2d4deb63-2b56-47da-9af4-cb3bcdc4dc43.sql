
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  chapter integer NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  percent integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT SELECT ON public.quiz_attempts TO anon;
GRANT ALL ON public.quiz_attempts TO service_role;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_read_all" ON public.quiz_attempts FOR SELECT TO public USING (true);
CREATE POLICY "quiz_insert_own" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX quiz_attempts_language_idx ON public.quiz_attempts (language);
CREATE INDEX quiz_attempts_user_lang_idx ON public.quiz_attempts (user_id, language, chapter);
