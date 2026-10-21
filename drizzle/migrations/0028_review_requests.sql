-- Asking clients for a review a few days after they downloaded their photos.
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS review_asked_at timestamptz;
