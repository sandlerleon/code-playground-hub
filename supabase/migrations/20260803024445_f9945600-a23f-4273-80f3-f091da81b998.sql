CREATE TABLE public.page_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  avatar_url TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX page_comments_page_key_idx ON public.page_comments (page_key, created_at DESC);
GRANT SELECT ON public.page_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_comments TO authenticated;
GRANT ALL ON public.page_comments TO service_role;
ALTER TABLE public.page_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comments" ON public.page_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can post their own comments" ON public.page_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.page_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.page_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);