-- Labels ("folders") for photos in the studio's media library.
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS media_tags_idx ON public.media USING gin (tags);
