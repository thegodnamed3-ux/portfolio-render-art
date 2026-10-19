-- A review can be linked to the photoshoot it is about.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS photoshoot_id uuid REFERENCES public.photoshoots(id) ON DELETE SET NULL;
