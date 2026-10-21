import { reviewMessage, tgApi, webhookSecret, withSite } from "@/lib/telegram.server";

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

  // Delivery link: extend by two weeks.
  const x = /^dl:x:([0-9a-f-]{36})$/.exec(String(cb.data ?? ""));
  if (x) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { formatDate } = await import("@/lib/reminders.server");
    const { esc } = await import("@/lib/telegram.server");
    const { data: d } = await supabaseAdmin.from("client_deliveries").select("id, title, client_name, expires_at").eq("id", x[1]!).maybeSingle();
    if (!d) {
      await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: "Delivery not found", show_alert: true });
      return ok();
    }
    const base = Math.max(Date.now(), d.expires_at ? new Date(d.expires_at).getTime() : 0);
    const until = new Date(base + 14 * 86400_000).toISOString();
    await supabaseAdmin.from("client_deliveries").update({ expires_at: until, expiry_reminded_at: null, is_active: true }).eq("id", d.id);
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: `Extended until ${formatDate(until)}` });
    await tgApi("editMessageText", {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: withSite([`<b>Link extended</b>`, "", `<b>${esc(d.client_name || d.title)}</b>`, d.client_name ? esc(d.title) : null, `Works until ${formatDate(until)}`].filter((l) => l !== null).join("\n")),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Extend 2 more weeks", callback_data: `dl:x:${d.id}` }]] },
    });
    return ok();
  }

  // Booking request: move it along (Talking / Shoot booked / Closed).
  const bk = /^bk:([tbc]):([0-9a-f-]{36})$/.exec(String(cb.data ?? ""));
  if (bk) {
    const stage = ({ t: ["in progress", "Talking"], b: ["booked", "Shoot booked"], c: ["closed", "Closed"] } as const)[bk[1] as "t" | "b" | "c"];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { esc } = await import("@/lib/telegram.server");
    const { data: q } = await (supabaseAdmin as any).from("booking_requests").update({ status: stage[0] }).eq("id", bk[2]).select("id, name, contact, shoot_type, wished_date, message").maybeSingle();
    if (!q) { await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: "Request not found", show_alert: true }); return ok(); }
    await tgApi("answerCallbackQuery", { callback_query_id: cb.id, text: stage[1] });
    const rest = (["t", "b", "c"] as const).filter((k) => k !== bk[1]).map((k) => ({ text: ({ t: "Talking", b: "Shoot booked", c: "Closed" })[k], callback_data: `bk:${k}:${q.id}` }));
    await tgApi("editMessageText", {
      chat_id: cb.message.chat.id, message_id: cb.message.message_id, parse_mode: "HTML", link_preview_options: { is_disabled: true },
      text: withSite([`<b>Booking request</b> · ${esc(stage[1])}`, "", `<b>${esc(q.name)}</b>`, esc(q.contact), `${esc(q.shoot_type)}${q.wished_date ? ` · ${esc(q.wished_date)}` : ""}`, q.message ? `\n<blockquote>${esc(q.message)}</blockquote>` : null].filter((l) => l !== null).join("\n")),
      reply_markup: { inline_keyboard: [rest, [{ text: "Open studio", url: `${new URL(request.url).origin}/admin` }]] },
    });
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
    text: withSite(html),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: layout },
  });
  return ok();
}
