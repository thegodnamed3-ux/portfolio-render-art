-- Expiry reminders: when the "link expires in 3 days" Telegram message was sent
-- (cleared whenever the expiry date changes), and when the site last looked for them.
ALTER TABLE public.client_deliveries ADD COLUMN IF NOT EXISTS expiry_reminded_at timestamptz;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS reminders_checked_at timestamptz;
