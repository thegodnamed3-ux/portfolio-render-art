-- "Selected works" on the homepage, edited in the studio: the photos (with captions)
-- and how many sit in a row on desktop. NULL = the built-in defaults.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS featured_work jsonb;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS featured_columns int;
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_featured_columns_check;
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_featured_columns_check
  CHECK (featured_columns IS NULL OR featured_columns BETWEEN 2 AND 6);