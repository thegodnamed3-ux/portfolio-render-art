-- Private client deliveries: finished photos shared through an unguessable link.
-- Only admins touch these tables; the public page reads them through a server
-- function (service role) after matching the link token.
CREATE TABLE public.client_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (char_length(token) >= 16),
  title text NOT NULL DEFAULT 'Untitled delivery',
  client_name text,
  message text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_delivery_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.client_deliveries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  preview_path text,
  file_name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  w int,
  h int,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_delivery_files_delivery_idx ON public.client_delivery_files (delivery_id, position);

CREATE TRIGGER client_deliveries_touch BEFORE UPDATE ON public.client_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_deliveries, public.client_delivery_files TO authenticated;
GRANT ALL ON public.client_deliveries, public.client_delivery_files TO service_role;

ALTER TABLE public.client_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_delivery_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages deliveries" ON public.client_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages delivery files" ON public.client_delivery_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Private bucket: no anonymous access at all; clients get short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public) VALUES ('client-deliveries', 'client-deliveries', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin reads delivery files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-deliveries' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin uploads delivery files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-deliveries' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates delivery files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-deliveries' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deletes delivery files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-deliveries' AND public.has_role(auth.uid(), 'admin'));
