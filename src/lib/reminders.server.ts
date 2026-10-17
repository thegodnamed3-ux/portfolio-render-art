import { esc, sendTelegram } from "@/lib/telegram.server";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Tallinn" }).replace(/\//g, ".");

/**
 * Looks (at most every 6 hours, piggy-backing on site traffic) for client links that
 * expire within 3 days and sends one Telegram reminder per link, with an "Extend" button.
 * Never throws.
 */
export async function checkExpiryReminders(sb: any, origin: string) {
  try {
    const now = Date.now();
    const { data: s, error } = await sb.from("site_settings").select("reminders_checked_at").eq("id", 1).maybeSingle();
    if (error) return; // database update not applied yet
    const last = s?.reminders_checked_at ? new Date(s.reminders_checked_at).getTime() : 0;
    if (now - last < 6 * 3600_000) return;
    // Claim the run so parallel requests don't all do it.
    let claim = sb.from("site_settings").update({ reminders_checked_at: new Date(now).toISOString() }).eq("id", 1);
    claim = s?.reminders_checked_at ? claim.eq("reminders_checked_at", s.reminders_checked_at) : claim.is("reminders_checked_at", null);
    const { data: claimed } = await claim.select("id");
    if (!claimed?.length) return;

    const { data: due } = await sb
      .from("client_deliveries")
      .select("id, title, client_name, expires_at")
      .eq("is_active", true)
      .is("expiry_reminded_at", null)
      .gt("expires_at", new Date(now).toISOString())
      .lt("expires_at", new Date(now + 3 * 86400_000).toISOString());
    for (const d of due ?? []) {
      const html = [
        "<b>Link expires soon</b>",
        "",
        `<b>${esc(d.client_name || d.title)}</b>`,
        d.client_name ? esc(d.title) : null,
        `Works until ${fmt(d.expires_at)}`,
      ].filter((l) => l !== null).join("\n");
      const ok = await sendTelegram(html, [], [
        [{ text: "Extend 2 weeks", callback_data: `dl:x:${d.id}` }],
        ...(origin ? [[{ text: "Open in studio", url: `${origin}/admin` }]] : []),
      ]);
      if (ok) await sb.from("client_deliveries").update({ expiry_reminded_at: new Date().toISOString() }).eq("id", d.id);
    }
  } catch (e) {
    console.error("checkExpiryReminders", e);
  }
}

export { fmt as formatDate };
