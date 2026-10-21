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

    await askForReviews(sb, origin);
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

/**
 * Three days after a client first downloads their photos (and hasn't left a review), ask once:
 * by email (client_email + RESEND_API_KEY secret) or, without those, a Telegram message with the
 * text ready to forward. Needs migration 0028 — does nothing before it.
 */
async function askForReviews(sb: any, origin: string) {
  if (!origin) return;
  const { data: ds, error } = await sb.from("client_deliveries").select("id, token, title, client_name, client_email").eq("is_active", true).is("review_asked_at", null);
  if (error || !ds?.length) return;
  const cutoff = new Date(Date.now() - 3 * 86400_000).toISOString();
  for (const d of ds) {
    const { data: ev } = await sb.from("client_delivery_events").select("created_at").eq("delivery_id", d.id).in("kind", ["download", "zip"]).order("created_at").limit(1);
    if (!ev?.length || ev[0].created_at > cutoff) continue;
    const { count } = await sb.from("reviews").select("id", { count: "exact", head: true }).eq("delivery_id", d.id);
    if (count) { await sb.from("client_deliveries").update({ review_asked_at: new Date().toISOString() }).eq("id", d.id); continue; }
    const link = `${origin}/g/${d.token}?review=1`;
    const name = (d.client_name || "").trim().split(/\s+/)[0] || "";
    let sent = false;
    const key = process.env["RESEND_API_KEY"];
    if (key && d.client_email) {
      const from = process.env["RESEND_FROM"] || "thegodnamed <onboarding@resend.dev>";
      const text = `${name ? `Hi ${name}!` : "Hi!"}\n\nThank you for the shoot. If you liked the photos, I'd be grateful for a few words — it takes a minute:\n${link}\n\nAitäh! / Спасибо!\n— Gor, thegodnamed`;
      try {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [d.client_email], subject: "How did the photos turn out?", text }) });
        sent = r.ok;
      } catch { /* fall back to Telegram */ }
    }
    if (!sent) {
      const msg = `${name ? `Hi ${name}!` : "Hi!"} Thank you for the shoot. If you liked the photos, I'd be grateful for a short review: ${link}`;
      sent = await sendTelegram(["<b>Ask for a review</b>", "", `<b>${esc(d.client_name || d.title)}</b>`, "Downloaded the photos 3+ days ago. Text to forward:", "", `<code>${esc(msg)}</code>`].join("\n"), [{ text: "Open review page", url: link }]);
    }
    if (sent) await sb.from("client_deliveries").update({ review_asked_at: new Date().toISOString() }).eq("id", d.id);
  }
}

export { fmt as formatDate };
