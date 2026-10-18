-- Selected works: photos per row on phones (1–3), set in the studio. NULL = two.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS featured_columns_mobile smallint;
