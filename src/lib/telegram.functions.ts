import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Is the bot configured, and where do its button presses go? */
export const telegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { tgApi } = await import("@/lib/telegram.server");
    if (!process.env["TELEGRAM_BOT_TOKEN"] || !process.env["TELEGRAM_CHAT_ID"]) return { configured: false, webhook: null as string | null };
    const info = await tgApi("getWebhookInfo", {});
    return { configured: true, webhook: (info?.result?.url as string) || null };
  });

/** Points the bot's button presses at this site's /api/telegram (call it from the published site). */
export const connectTelegramButtons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { tgApi, webhookSecret, siteOrigin } = await import("@/lib/telegram.server");
    const secret = await webhookSecret();
    if (!secret || !process.env["TELEGRAM_CHAT_ID"]) throw new Error("Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Lovable Cloud first.");
    const origin = await siteOrigin();
    if (!origin.startsWith("https://")) throw new Error("Open the studio on the published site (https) and try again.");
    const url = `${origin}/api/telegram`;
    const r = await tgApi("setWebhook", { url, secret_token: secret, allowed_updates: ["callback_query"], drop_pending_updates: true });
    if (!r?.ok) throw new Error(r?.description ?? "Telegram did not accept the address");
    return { url };
  });
