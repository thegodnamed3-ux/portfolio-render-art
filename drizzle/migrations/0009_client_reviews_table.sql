-- Client reviews. Submitted only from a working client-delivery link (checked by a
-- server function), moderated in the studio; only approved ones reach the website.
-- No anonymous table access: public reads and writes go through server functions.
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.client_deliveries(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  rating int CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_status_created_idx ON public.reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_delivery_idx ON public.reviews (delivery_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages reviews" ON public.reviews;
CREATE POLICY "admin manages reviews" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));