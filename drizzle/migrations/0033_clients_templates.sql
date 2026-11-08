-- Clients (with company) and message templates for client deliveries; a delivery can belong to a client.
CREATE TABLE IF NOT EXISTS public.studio_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  lang text NOT NULL DEFAULT 'en',
  template_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_studio_clients ON public.studio_clients;
CREATE POLICY admin_studio_clients ON public.studio_clients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS admin_message_templates ON public.message_templates;
CREATE POLICY admin_message_templates ON public.message_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.studio_clients(id) ON DELETE SET NULL;
-- Client page: also by saved client (created here too in case the client-page update was skipped).
CREATE TABLE IF NOT EXISTS public.client_portals (
  token text PRIMARY KEY,
  email text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_client_portals ON public.client_portals;
CREATE POLICY admin_client_portals ON public.client_portals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.client_portals ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS client_id uuid UNIQUE REFERENCES public.studio_clients(id) ON DELETE CASCADE;
