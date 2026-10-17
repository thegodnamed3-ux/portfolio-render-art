import { createServerFn } from "@tanstack/react-start";

export const SHOOT_TYPES = ["Portraits", "Couples", "Commercial", "Automotive", "Video", "Real estate", "Other"] as const;

/**
 * Booking request from the website, delivered to Telegram by a bot.
 * Needs two secrets in Lovable Cloud: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 */
export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; contact: string; type: string; date?: string; message?: string; website?: string }) => {
    const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
    const name = clip(input?.name, 80);
    const contact = clip(input?.contact, 120);
    const type = (SHOOT_TYPES as readonly string[]).includes(String(input?.type)) ? String(input.type) : "Other";
    const date = clip(input?.date, 40);
    const message = clip(input?.message, 1500);
    if (!name) throw new Error("Please add your name.");
    if (contact.length < 4) throw new Error("Please add a phone, e-mail or Telegram so I can reply.");
    // Honeypot: real visitors never see or fill this field.
    return { name, contact, type, date, message, bot: !!clip(input?.website, 200) };
  })
  .handler(async ({ data }) => {
    if (data.bot) return { ok: true };
    const { sendTelegram, esc, replyButton, siteOrigin } = await import("@/lib/telegram.server");
    const html = [
      "<b>New booking request</b>",
      "",
      `<b>${esc(data.name)}</b>`,
      esc(data.contact),
      `${esc(data.type)}${data.date ? ` · ${esc(data.date)}` : ""}`,
      data.message ? `\n<blockquote>${esc(data.message)}</blockquote>` : null,
    ].filter((l) => l !== null).join("\n");
    const origin = await siteOrigin();
    const reply = replyButton(data.contact);
    const ok = await sendTelegram(html, [...(reply ? [reply] : []), ...(origin ? [{ text: "Open website", url: origin }] : [])]);
    if (!ok) {
      throw new Error("Could not send the request — please message me on Telegram or WhatsApp.");
    }
    return { ok: true };
  });
