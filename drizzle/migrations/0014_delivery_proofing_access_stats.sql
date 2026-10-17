-- Client deliveries, round two:
--  * proofing: the client hearts photos and leaves a note per photo;
--  * access: optional password (salted SHA-256, never stored in clear) and expiry date;
--  * stats: one row per open / single download / ZIP download.
-- Everything stays admin-only at the table level; clients act through server functions
-- that check the link token (and password) first.
ALTER TABLE public.client_delivery_files ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_delivery_files ADD COLUMN IF NOT EXISTS client_note text;

ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.client_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.client_deliveries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'download', 'zip')),
  file_id uuid REFERENCES public.client_delivery_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_delivery_events_delivery_idx ON public.client_delivery_events (delivery_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_delivery_events TO authenticated;
GRANT ALL ON public.client_delivery_events TO service_role;
ALTER TABLE public.client_delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manages delivery events" ON public.client_delivery_events;
CREATE POLICY "admin manages delivery events" ON public.client_delivery_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
