import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "Load homepage from Wfolio" (studio → Homepage). Finds the photos on the old Wfolio home page,
 * copies each one into our own storage (one photo per call, driven by the studio), and returns
 * them so the studio can put them into the hero slides. Copies are recognised by their original
 * URL, so running it again never duplicates anything.
 */
const SITE = "https://thegodnamed.wfolio.pro";
const ALBUM = "Wfolio homepage";
const BUCKET = "portfolio";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const abs = (u: string) => (u.startsWith("//") ? `https:${u}` : u.startsWith("/") ? `${SITE}${u}` : u);
const isCdn = (u: string) => /^https:\/\/([a-z0-9-]+\.)*wfolio\.(com|pro)\//i.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type WfolioHomePhoto = { full: string; sm: string; w: number; h: number };

export const discoverWfolioHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ photos: WfolioHomePhoto[]; already: number }> => {
    await assertAdmin(context);
    const res = await fetch(`${SITE}/`);
    if (!res.ok) throw new Error(`Wfolio did not answer (${res.status})`);
    const html = await res.text();
    const out: WfolioHomePhoto[] = [];
    const seen = new Set<string>();
    const push = (p: WfolioHomePhoto) => { if (!isCdn(p.full) || seen.has(p.full)) return; seen.add(p.full); out.push(p); };
    // Gallery pieces carry every size with its dimensions.
    for (const m of html.matchAll(/data-gallery-versions="([^"]*)"/g)) {
      try {
        const v = (JSON.parse(unescape(m[1]!)) as { src: string; w: number; h: number }[]).sort((a, b) => a.w - b.w);
        if (!v.length) continue;
        const big = v[v.length - 1]!;
        const small = v.find((x) => x.w >= 600) ?? big;
        push({ full: abs(big.src), sm: abs(small.src), w: big.w, h: big.h });
      } catch { /* skip */ }
    }
    // Cover slides and plain images (sizes unknown — the studio reads them after copying).
    for (const m of html.matchAll(/(?:data-src|src|data-bg|data-background)="([^"]+)"/g)) { const u = abs(unescape(m[1]!)); push({ full: u, sm: u, w: 0, h: 0 }); }
    for (const m of html.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) { const u = abs(unescape(m[2]!)); push({ full: u, sm: u, w: 0, h: 0 }); }
    const { count } = await context.supabase.from("media").select("id", { count: "exact", head: true }).eq("album", ALBUM);
    return { photos: out.slice(0, 80), already: count ?? 0 };
  });

async function copy(sb: any, url: string, path: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wfolio answered ${res.status}`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const up = await sb.storage.from(BUCKET).upload(path, await res.arrayBuffer(), { contentType: type, cacheControl: "31536000", upsert: true });
  if (up.error) throw new Error(up.error.message);
  const signed = await sb.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signed.error) throw new Error(signed.error.message);
  return signed.data.signedUrl as string;
}

export const copyWfolioHomePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: WfolioHomePhoto) => {
    if (!isCdn(d.full) || !isCdn(d.sm)) throw new Error("Not a Wfolio photo");
    return { full: d.full, sm: d.sm, w: Math.max(0, Number(d.w) || 0), h: Math.max(0, Number(d.h) || 0) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: existing } = await sb.from("media").select("id, src, sm, w, h").eq("source_url", data.full).maybeSingle();
    if (existing) return { id: existing.id as string, src: existing.src as string, sm: existing.sm as string, w: existing.w as number, h: existing.h as number, reused: true };
    const id = crypto.randomUUID();
    const full = await copy(sb, data.full, `wfolio/home/${id}-full.jpg`);
    const sm = data.sm === data.full ? full : await copy(sb, data.sm, `wfolio/home/${id}-sm.jpg`);
    const { data: row, error } = await sb.from("media")
      .insert({ id, sm, src: full, full_src: full, w: data.w || 1600, h: data.h || 1067, album: ALBUM, source_url: data.full, storage_path: `wfolio/home/${id}-full.jpg` })
      .select("id, src, sm, w, h").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, src: row.src as string, sm: row.sm as string, w: row.w as number, h: row.h as number, reused: false };
  });
