/**
 * Sends a plain-text message to the studio's Telegram chat through the bot.
 * Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (Lovable Cloud secrets).
 * Returns false instead of throwing, so callers decide whether a failure matters.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chat = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chat) {
    console.error("sendTelegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
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
