import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Re-import from the original Wfolio site, one source album → one draft photoshoot pending review. */
const SITE = "https://thegodnamed.wfolio.pro";
export const IMPORT_BATCH = "wfolio-reimport";
const CATEGORY_PAGES: Record<string, string> = { women: "portraits", men: "portraits", couple: "couples", commerce: "commercial", cars: "automotive" };
const SKIP = new Set(["", "women", "men", "couple", "commerce", "cars", "reels", "reviews", "legal-privacy", "favicon.ico"]);

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const abs = (u: string) => (u.startsWith("//") ? `https:${u}` : u);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type DiscoveredAlbum = { slug: string; category: string; source: string; order: number };

/** Lists every album linked from the original category pages. */
export const discoverWfolioAlbums = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ albums: DiscoveredAlbum[]; failedPages: string[] }> => {
    await assertAdmin(context);
    const albums: DiscoveredAlbum[] = [];
    const failedPages: string[] = [];
    const seen = new Set<string>();
    for (const [page, category] of Object.entries(CATEGORY_PAGES)) {
      const res = await fetch(`${SITE}/${page}`);
      if (!res.ok) { failedPages.push(`${page} (${res.status})`); continue; }
      const html = await res.text();
      for (const m of html.matchAll(/href="\/([^"#?/]+)"/g)) {
        const slug = m[1]!;
        if (SKIP.has(slug) || slug.startsWith("assets") || seen.has(slug)) continue;
        seen.add(slug);
        albums.push({ slug, category, source: page, order: albums.length });
      }
    }
    return { albums, failedPages };
  });

export type AlbumResult = { slug: string; url: string; title: string; status: "imported" | "exists" | "empty" | "failed"; photos: number; newMedia: number; reused: number; error?: string };

/** Imports one album as a draft photoshoot (review_status = pending). Never touches existing shoots. */
export const importWfolioAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: DiscoveredAlbum) => {
    if (!/^[a-z0-9-]+$/.test(d.slug) || !Object.values(CATEGORY_PAGES).includes(d.category)) throw new Error("Bad album");
    return d;
  })
  .handler(async ({ data, context }): Promise<AlbumResult> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const url = `${SITE}/${data.slug}`;
    const base = { slug: data.slug, url, title: data.slug, photos: 0, newMedia: 0, reused: 0 };

    const { data: existing } = await sb.from("photoshoots").select("id").eq("source_url", url).eq("import_batch", IMPORT_BATCH).maybeSingle();
    if (existing) return { ...base, status: "exists" };

    const res = await fetch(url);
    if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` };
    const html = await res.text();
    const title = unescape(html.match(/<title>([^<]*)/)?.[1] ?? data.slug).split(". ")[0]!.trim() || data.slug;

    const pieces: { pid: string; sm: string; full: string; w: number; h: number }[] = [];
    for (const m of html.matchAll(/<a class="link js-gallery-link"([^>]*)>/g)) {
      const a = m[1]!;
      const pid = a.match(/data-gallery-piece-id="(\d+)"/)?.[1];
      const vers = a.match(/data-gallery-versions="([^"]*)"/)?.[1];
      const href = a.match(/href="([^"]+)"/)?.[1];
      if (!pid || !vers || !href) continue;
      const v = (JSON.parse(unescape(vers)) as { src: string; w: number; h: number }[]).sort((x, y) => x.w - y.w);
      if (!v.length) continue;
      const big = v[v.length - 1]!;
      pieces.push({ pid, sm: abs(v[0]!.src), full: abs(href), w: big.w, h: big.h });
    }
    if (!pieces.length) return { ...base, title, status: "empty" };

    // Duplicates: match by source piece id, then by original file URL (photos from the first import).
    const fulls = pieces.map((p) => p.full);
    const pids = pieces.map((p) => p.pid);
    const [byPid, byFull] = await Promise.all([
      sb.from("media").select("id, source_piece_id").in("source_piece_id", pids),
      sb.from("media").select("id, full_src, source_piece_id").in("full_src", fulls),
    ]);
    const idByPid = new Map<string, string>();
    (byPid.data ?? []).forEach((m: any) => idByPid.set(m.source_piece_id, m.id));
    let reused = 0;
    for (const m of byFull.data ?? []) {
      const p = pieces.find((x) => x.full === m.full_src);
      if (!p || idByPid.has(p.pid)) continue;
      idByPid.set(p.pid, m.id);
      if (!m.source_piece_id) await sb.from("media").update({ source_piece_id: p.pid, source_url: url }).eq("id", m.id);
    }
    reused = pieces.filter((p) => idByPid.has(p.pid)).length;

    const fresh = pieces.filter((p) => !idByPid.has(p.pid));
    if (fresh.length) {
      const { data: ins, error } = await sb
        .from("media")
        .insert(fresh.map((p) => ({ sm: p.sm, src: p.sm, full_src: p.full, w: p.w, h: p.h, album: title, origin_category: data.category, source_piece_id: p.pid, source_url: url })))
        .select("id, source_piece_id");
      if (error) return { ...base, title, status: "failed", error: error.message };
      ins.forEach((m: any) => idByPid.set(m.source_piece_id, m.id));
    }

    const ids = pieces.map((p) => idByPid.get(p.pid)!).filter(Boolean);
    const { data: shoot, error: e2 } = await sb
      .from("photoshoots")
      .insert({ category: data.category, title, album: title, cover_media_id: ids[0] ?? null, status: "draft", sort_order: 1000 + data.order, source_url: url, source_album: title, import_batch: IMPORT_BATCH, review_status: "pending" })
      .select("id")
      .single();
    if (e2) return { ...base, title, status: "failed", error: e2.message };
    const { error: e3 } = await sb.from("photoshoot_images").insert(ids.map((media_id, position) => ({ photoshoot_id: shoot.id, media_id, position })));
    if (e3) return { ...base, title, status: "failed", error: e3.message };

    return { ...base, title, status: "imported", photos: ids.length, newMedia: fresh.length, reused };
  });
