ALTER TABLE public.client_delivery_events DROP CONSTRAINT IF EXISTS client_delivery_events_kind_check;
ALTER TABLE public.client_delivery_events ADD CONSTRAINT client_delivery_events_kind_check
  CHECK (kind IN ('view', 'download', 'zip', 'picks')) NOT VALID;
CREATE TABLE IF NOT EXISTS public.page_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  country text,
  device text CHECK (device IS NULL OR device IN ('mobile', 'tablet', 'desktop')),
  visitor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_created_idx ON public.page_views (created_at DESC);
GRANT SELECT, DELETE ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads page views" ON public.page_views;
CREATE POLICY "admin reads page views" ON public.page_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin deletes page views" ON public.page_views;
CREATE POLICY "admin deletes page views" ON public.page_views FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS report_week text;