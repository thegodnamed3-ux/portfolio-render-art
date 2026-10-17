import { reviewMessage, tgApi, webhookSecret } from "@/lib/telegram.server";

/**
 * Telegram calls this when a button under a bot message is pressed.
 * Only accepts calls carrying our secret, from the studio's own chat.
 * Handles "rv:p:<id>" (publish) and "rv:h:<id>" (hide) for reviews.
 */
export async function handleTelegramUpdate(request: Request): Promise<Response> {
  const ok = () => new Response("ok");
  const secret = await webhookSecret();
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 403 });

  let update: any;
  try { update = await request.json(); } catch { return ok(); }
  const cb = update?.callback_query;
  if (!cb) return ok();

  const chatId = String(cb.message?.chat?.id ?? "");
  if (chatId !== String(process.env["TELEGRAM_CHAT_ID"] ?? "")) {
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: "Not allowed" });
    return ok();
  }

  const m = /^rv:([ph]):([0-9a-f-]{36})$/.exec(String(cb.data ?? ""));
  if (!m) {
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
    return ok();
  }
  const status = m[1] === "p" ? "approved" : "hidden";
  const id = m[2]!;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: r, error } = await supabaseAdmin
    .from("reviews")
    .update({ status })
    .eq("id", id)
    .select("id, name, body, status, client_deliveries(title)")
    .maybeSingle();
  if (error || !r) {
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: "Review not found", show_alert: true });
    return ok();
  }

  const origin = new URL(request.url).origin;
  const source = (r as any).client_deliveries?.title ?? null;
  const { html, layout } = reviewMessage({ id: r.id, name: r.name, body: r.body, status: r.status, source }, origin);
  await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: status === "approved" ? "Published on the website" : "Hidden" });
  await tgApi("editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: layout },
  });
  return ok();
}
