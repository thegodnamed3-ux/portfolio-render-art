-- Custom watermark (logo) on delivered photos: the logo setup per delivery, and each photo's copy with it.
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS brand jsonb;
ALTER TABLE public.client_delivery_files ADD COLUMN IF NOT EXISTS branded_path text;