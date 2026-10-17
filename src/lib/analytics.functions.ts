import { createServerFn } from "@tanstack/react-start";

const SKIP = /^\/(admin|auth|g\/|api\/)/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pingdom|monitor/i;

/** Groups referrers into readable sources (all Google domains → "google", etc.). */
function source(ref: string, ownHost: string): string | null {
  let host: string;
  try { host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
  if (!host || host === ownHost.replace(/^www\./, "")) return null;
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)facebook\.com$|(^|\.)fb\.me$/.test(host)) return "facebook";
  if (host === "t.co" || /(^|\.)(twitter|x)\.com$/.test(host)) return "x";
  if (/(^|\.)t\.me$|telegram/.test(host)) return "telegram";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)yandex\./.test(host)) return "yandex";
  if (/(^|\.)behance\.net$/.test(host)) return "behance";
  if (/(^|\.)linkedin\.com$|lnkd\.in/.test(host)) return "linkedin";
  return host;
}

function device(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** ISO week like "2026-W42" (weeks start on Monday). */
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Records one page view without cookies or stored IPs. Never throws. */
export const trackView = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string; referrer?: string }) => ({
    path: String(input?.path ?? "/").slice(0, 200) || "/",
    referrer: String(input?.referrer ?? "").slice(0, 500),
  }))
  .handler(async ({ data }) => {
    try {
      if (SKIP.test(data.path)) return { ok: true };
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const ua = req.headers.get("user-agent") ?? "";
      if (!ua || BOT.test(ua)) return { ok: true };
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const host = new URL(req.url).hostname;
      const day = new Date().toISOString().slice(0, 10);
      const visitor = await sha(`${ip}|${ua}|${day}|${process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "salt"}`);
      const country = req.headers.get("cf-ipcountry");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("page_views").insert({
        path: data.path,
        referrer: data.referrer ? source(data.referrer, host) : null,
        country: country && country !== "XX" ? country : null,
        device: device(ua),
        visitor,
      });
      await maybeSendWeekly(supabaseAdmin, `https://${host}`);
    } catch (e) {
      console.error("trackView", e);
    }
    return { ok: true };
  });

/** Once per week, the first visit after Monday sends last week's summary to Telegram. */
async function maybeSendWeekly(sb: any, origin: string) {
  const now = new Date();
  const week = isoWeek(now);
  const { data: s } = await sb.from("site_settings").select("report_week").eq("id", 1).maybeSingle();
  const last = s?.report_week ?? null;
  if (last === week) return;
  // Claim this week first so parallel visits don't send twice.
  let claim = sb.from("site_settings").update({ report_week: week }).eq("id", 1);
  claim = last === null ? claim.is("report_week", null) : claim.eq("report_week", last);
  const { data: claimed } = await claim.select("id");
  if (!claimed?.length) return;
  // Retention promised in the privacy policy: visit records older than two years go.
  await sb.from("page_views").delete().lt("created_at", new Date(now.getTime() - 730 * 86400000).toISOString());
  if (last === null) return; // first run only sets the marker

  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() || 7) - 1)));
  const from = new Date(monday.getTime() - 7 * 86400000);
  const before = new Date(from.getTime() - 7 * 86400000);
  const rows: { path: string; referrer: string | null; visitor: string; created_at: string }[] = [];
  for (let a = 0; ; a += 1000) {
    const { data } = await sb.from("page_views").select("path, referrer, visitor, created_at").gte("created_at", before.toISOString()).lt("created_at", monday.toISOString()).order("id").range(a, a + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const inWeek = rows.filter((r) => new Date(r.created_at) >= from);
  const prev = rows.filter((r) => new Date(r.created_at) < from);
  const visitors = (rs: typeof rows) => new Set(rs.map((r) => `${r.created_at.slice(0, 10)}|${r.visitor}`)).size;
  const top = (vals: (string | null)[], n = 3) => {
    const m = new Map<string, number>();
    vals.forEach((v) => v && m.set(v, (m.get(v) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  };
  const v = visitors(inWeek), pv = visitors(prev);
  const delta = pv ? Math.round(((v - pv) / pv) * 100) : null;
  const { sendTelegram, esc } = await import("@/lib/telegram.server");
  const fmt = (d: Date) => d.toISOString().slice(5, 10).split("-").reverse().join(".");
  const pages = top(inWeek.map((r) => r.path));
  const sources = top(inWeek.map((r) => r.referrer));
  const html = [
    `<b>Website · week ${fmt(from)}–${fmt(new Date(monday.getTime() - 86400000))}</b>`,
    "",
    `${v} visitors${delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${delta}% vs week before)`}`,
    `${inWeek.length} page views`,
    pages.length ? `\n<b>Top pages</b>\n${pages.map(([p, c]) => `${esc(p)} — ${c}`).join("\n")}` : null,
    sources.length ? `\n<b>Came from</b>\n${sources.map(([p, c]) => `${esc(p)} — ${c}`).join("\n")}` : null,
  ].filter((l) => l !== null).join("\n");
  await sendTelegram(html, [{ text: "Open statistics", url: `${origin}/admin` }]);
}
