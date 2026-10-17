-- Watermark until paid: while on, the client page shows watermarked previews only and
-- offers no original downloads. Watermarked previews are generated in the studio.
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS watermark boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_delivery_files ADD COLUMN IF NOT EXISTS preview_wm_path text;