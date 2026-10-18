-- Selected works, desktop: one large photo with thumbnails beside it (photos + captions), set in the studio.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS featured_spotlight jsonb;