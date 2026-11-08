-- Client page (/c/<token>): one link per client e-mail with all their active galleries.
CREATE TABLE IF NOT EXISTS public.client_portals (
  token text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_client_portals ON public.client_portals;
CREATE POLICY admin_client_portals ON public.client_portals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Statistics: where each enquiry came from (google, instagram, direct…).
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS source text;
