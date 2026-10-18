export type TgButton = { text: string; url: string } | { text: string; callback_data: string };

/**
 * The same bot and chat also receive messages from the HŌRA Studios site, so every message starts
 * with the site's name on its own line.
 */
export const SITE_TAG = "THEGODNAMED";
export const withSite = (html: string) => `<b>${SITE_TAG}</b>\n${html}`;

/** Escapes user text for Telegram's HTML formatting. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sends a formatted message (Telegram HTML) to the studio chat through the bot, with
 * optional link buttons underneath (one row each).
 * Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (Lovable Cloud secrets).
 * Returns false instead of throwing, so callers decide whether a failure matters.
 */
export async function sendTelegram(html: string, buttons: TgButton[] = [], layout?: TgButton[][]): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chat = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chat) {
    console.error("sendTelegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set");
    return false;
  }
  const ok = (b: TgButton) => ("url" in b ? /^https:\/\//.test(b.url) : b.callback_data.length <= 64);
  const rows = (layout ?? buttons.map((b) => [b])).map((r) => r.filter(ok)).filter((r) => r.length);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: withSite(html),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(rows.length ? { reply_markup: { inline_keyboard: rows } } : {}),
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

/** Calls any Bot API method; returns the parsed reply (or null on network failure). */
export async function tgApi(method: string, payload: Record<string, unknown>): Promise<any> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    console.error("tgApi", method, e);
    return null;
  }
}

/** Secret Telegram sends back with every webhook call — derived from the bot token, so no extra setting. */
export async function webhookSecret(): Promise<string | null> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}:thegodnamed-webhook`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

export type ReviewForMessage = { id: string; name: string; body: string; status: string; source?: string | null };

/** The review notification — same layout when first sent and after Publish / Hide. */
export function reviewMessage(r: ReviewForMessage, origin: string) {
  const state = r.status === "approved" ? "published" : r.status === "hidden" ? "hidden" : "awaiting approval";
  const html = [
    `<b>${r.status === "pending" ? "New review" : "Review"}</b> · ${state}`,
    "",
    `<b>${esc(r.name)}</b>`,
    r.source ? esc(r.source) : null,
    "",
    `<blockquote>${esc(r.body)}</blockquote>`,
  ].filter((l) => l !== null).join("\n");
  const actions: TgButton[] = [];
  if (r.status !== "approved") actions.push({ text: "Publish", callback_data: `rv:p:${r.id}` });
  if (r.status !== "hidden") actions.push({ text: "Hide", callback_data: `rv:h:${r.id}` });
  const layout: TgButton[][] = [actions];
  if (origin) layout.push([{ text: "Edit in studio", url: `${origin}/admin` }]);
  return { html, layout };
}
