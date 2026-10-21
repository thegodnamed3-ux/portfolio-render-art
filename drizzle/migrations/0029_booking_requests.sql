-- Booking requests from the website, kept as a simple pipeline in the studio (they used to go to Telegram only).
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  shoot_type text NOT NULL DEFAULT 'Other',
  wished_date text,
  message text,
  status text NOT NULL DEFAULT 'new',
  shoot_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manages booking requests" ON public.booking_requests;
CREATE POLICY "admin manages booking requests" ON public.booking_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Idempotent companions that were staged but never applied.
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS media_tags_idx ON public.media USING gin (tags);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS photoshoot_id uuid REFERENCES public.photoshoots(id) ON DELETE SET NULL;
ALTER TABLE public.photoshoots ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.photoshoots ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS review_asked_at timestamptz;