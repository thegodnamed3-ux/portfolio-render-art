-- Photo shown when a client gallery link is shared (Telegram, WhatsApp…); empty = the first photo.
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS cover_file uuid;

