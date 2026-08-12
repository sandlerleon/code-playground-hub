CREATE TABLE public.github_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_login text NOT NULL,
  token_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;