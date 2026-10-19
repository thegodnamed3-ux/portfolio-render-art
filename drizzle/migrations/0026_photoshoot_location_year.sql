-- Where and when a photoshoot was made, chosen in the studio and shown on its gallery page.
ALTER TABLE public.photoshoots ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.photoshoots ADD COLUMN IF NOT EXISTS year integer;
