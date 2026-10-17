ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_source_key_key ON public.reviews (source_key);