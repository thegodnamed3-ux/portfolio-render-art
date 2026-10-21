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
