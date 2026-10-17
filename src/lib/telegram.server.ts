export type TgButton = { text: string; url: string };

/** Escapes user text for Telegram's HTML formatting. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sends a formatted message (Telegram HTML) to the studio chat through the bot, with
 * optional link buttons underneath (one row each).
 * Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (Lovable Cloud secrets).
 * Returns false instead of throwing, so callers decide whether a failure matters.
 */
export async function sendTelegram(html: string, buttons: TgButton[] = []): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chat = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chat) {
    console.error("sendTelegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set");
    return false;
  }
  const valid = buttons.filter((b) => /^https:\/\//.test(b.url));
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(valid.length ? { reply_markup: { inline_keyboard: valid.map((b) => [b]) } } : {}),
      }),
    });
    if (!res.ok) console.error("sendTelegram: Telegram answered", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("sendTelegram", e);
    return false;
  }
}

/** The site's own origin for links in messages (e.g. to the studio). */
export async function siteOrigin(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

/** A one-tap way to answer: Telegram for @handles / t.me links, WhatsApp for phone numbers. */
export function replyButton(contact: string): TgButton | null {
  const c = contact.trim();
  const link = c.match(/t\.me\/([A-Za-z0-9_]{5,32})/i);
  if (link) return { text: "Reply in Telegram", url: `https://t.me/${link[1]}` };
  const handle = c.match(/^@([A-Za-z][A-Za-z0-9_]{4,31})$/);
  if (handle) return { text: "Reply in Telegram", url: `https://t.me/${handle[1]}` };
  const digits = c.replace(/[\s().-]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) {
    // Short local numbers without a country code are taken as Estonian (+372).
    const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : digits.length <= 8 ? `372${digits}` : digits;
    return { text: "Reply in WhatsApp", url: `https://wa.me/${intl}` };
  }
  return null;
}
