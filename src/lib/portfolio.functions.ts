import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Session } from "@/content/sessions";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Published photoshoots of one category, in display order, for public pages. */
export const getPublishedSessions = createServerFn({ method: "GET" })
  .inputValidator((input: { category: string }) => input)
  .handler(async ({ data }): Promise<Session[]> => {
    const sb = publicClient();
    const { data: shoots, error } = await sb
      .from("photoshoots")
      .select("id, category, title, album, cover_media_id, photoshoot_images(position, media(id, sm, src, full_src, w, h))")
      .eq("category", data.category)
      .eq("status", "published")
      .order("sort_order");
    if (error) {
      console.error("getPublishedSessions", error);
      return [];
    }
    return (shoots ?? [])
      .map((s) => {
        const imgs = [...(s.photoshoot_images ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((i) => i.media)
          .filter((m): m is NonNullable<typeof m> => !!m)
          .map((m) => ({ id: m.id, sm: m.sm, src: m.src, full: m.full_src, w: m.w, h: m.h, project: s.title }));
        // Cover first, rest in arranged order.
        const ci = imgs.findIndex((m) => m.id === s.cover_media_id);
        if (ci > 0) imgs.unshift(imgs.splice(ci, 1)[0]!);
        const images = imgs.map(({ id: _id, ...p }) => p);
        return { id: s.id, category: s.category, album: s.album ?? s.title, title: s.title, cover: images[0]!, images, count: images.length };
      })
      .filter((s) => s.count > 0);
  });

type Cover = { sm: string; src: string; full: string; w: number; h: number };

/** Archive: every published shoot of a category as title + cover + count — no full image lists. */
export const getArchiveShoots = createServerFn({ method: "GET" })
  .inputValidator((input: { category: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: shoots, error } = await sb
      .from("photoshoots")
      .select("id, title, cover_media_id, photoshoot_images(count)")
      .eq("category", data.category)
      .eq("status", "published")
      .order("sort_order");
    if (error || !shoots) {
      console.error("getArchiveShoots", error);
      return [];
    }
    const list = shoots.map((s) => ({ id: s.id, title: s.title, cover: s.cover_media_id as string | null, count: Number((s.photoshoot_images as unknown as { count: number }[])?.[0]?.count ?? 0) })).filter((s) => s.count > 0);
    // Shoots without a chosen cover use their first photo.
    const missing = list.filter((s) => !s.cover).map((s) => s.id);
    if (missing.length) {
      const { data: firsts } = await sb.from("photoshoot_images").select("photoshoot_id, media_id, position").in("photoshoot_id", missing).order("position");
      const first = new Map<string, string>();
      (firsts ?? []).forEach((r) => { if (!first.has(r.photoshoot_id)) first.set(r.photoshoot_id, r.media_id); });
      list.forEach((s) => { if (!s.cover) s.cover = first.get(s.id) ?? null; });
    }
    const ids = [...new Set(list.map((s) => s.cover).filter(Boolean))] as string[];
    const { data: media } = ids.length ? await sb.from("media").select("id, sm, src, full_src, w, h").in("id", ids) : { data: [] };
    const byId = new Map((media ?? []).map((m) => [m.id, { sm: m.sm, src: m.src, full: m.full_src, w: m.w, h: m.h } as Cover]));
    return list
      .map((s) => ({ id: s.id, title: s.title, count: s.count, cover: s.cover ? byId.get(s.cover) : undefined }))
      .filter((s): s is { id: string; title: string; count: number; cover: Cover } => !!s.cover);
  });

/** One published shoot with its photos, for its own Archive page. */
export const getPublishedShoot = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Session | null> => {
    const sb = publicClient();
    const { data: s, error } = await sb
      .from("photoshoots")
      .select("id, category, title, album, cover_media_id, photoshoot_images(position, media(id, sm, src, full_src, w, h))")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();
    if (error || !s) return null;
    const imgs = [...(s.photoshoot_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => i.media)
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ id: m.id, sm: m.sm, src: m.src, full: m.full_src, w: m.w, h: m.h, project: s.title }));
    const ci = imgs.findIndex((m) => m.id === s.cover_media_id);
    if (ci > 0) imgs.unshift(imgs.splice(ci, 1)[0]!);
    const images = imgs.map(({ id: _id, ...p }) => p);
    if (!images.length) return null;
    return { id: s.id, category: s.category, album: s.album ?? s.title, title: s.title, cover: images[0]!, images, count: images.length };
  });

/** One-time import of the photos originally taken from Wfolio, grouped by album as private drafts. */
export const importWfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { count } = await sb.from("media").select("id", { count: "exact", head: true }).not("origin_category", "is", null);
    if ((count ?? 0) > 0) return { imported: 0, sessions: 0, skipped: true };

    const media = await import("@/content/media");
    const cats = { portraits: media.portraits, couples: media.couples, commercial: media.commercial, automotive: media.automotive };
    let imported = 0;
    let sessions = 0;
    for (const [category, photos] of Object.entries(cats)) {
      const rows = photos.map((p) => ({ sm: p.sm, src: p.src, full_src: p.full, w: p.w, h: p.h, album: p.project, origin_category: category }));
      const { data: inserted, error } = await sb.from("media").insert(rows).select("id, album");
      if (error) throw new Error(error.message);
      imported += inserted.length;
      const albums = new Map<string, string[]>();
      inserted.forEach((m) => albums.set(m.album!, [...(albums.get(m.album!) ?? []), m.id]));
      let order = 0;
      for (const [album, ids] of albums) {
        const { data: shoot, error: e2 } = await sb
          .from("photoshoots")
          .insert({ category, title: album, album, cover_media_id: ids[0]!, status: "draft", sort_order: order++ })
          .select("id")
          .single();
        if (e2) throw new Error(e2.message);
        await sb.from("photoshoot_images").insert(ids.map((media_id, position) => ({ photoshoot_id: shoot.id, media_id, position })));
        sessions++;
      }
    }
    return { imported, sessions, skipped: false };
  });

/** Public site settings (e.g. WhatsApp link set in the studio). */
export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("site_settings").select("whatsapp_url").eq("id", 1).maybeSingle();
  return { whatsapp: data?.whatsapp_url?.trim() || null };
});

export type HomeImage = { src: string; w: number; h: number; pos?: string; /** ~600px copy for grids on phones. */ sm?: string };

/** Homepage hero slides and About portrait chosen in the studio (null = site defaults). */
export const getHomeMedia = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  // One round trip: "*" also survives columns that a pending migration hasn't added yet.
  const { data: row } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
  const d = (row ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) && v.length ? (v as (HomeImage & { caption?: string })[]) : null);
  const hero = list(d.hero_slides) as HomeImage[] | null;
  const about = d.about_image && typeof d.about_image === "object" ? (d.about_image as HomeImage) : null;
  const work = list(d.featured_work);
  const spotlight = list(d.featured_spotlight);
  const columns = typeof d.featured_columns === "number" ? d.featured_columns : null;
  const columnsMobile = typeof d.featured_columns_mobile === "number" ? d.featured_columns_mobile : null;

  // Older selections were saved without the small copy. Look them up ONCE and write the result back,
  // so later visits never scan the library again (items without a smaller copy keep their own image).
  const lacking = [...(work ?? []), ...(spotlight ?? [])].filter((x) => !x.sm);
  if (lacking.length) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const srcs = [...new Set(lacking.map((x) => x.src))].slice(0, 60);
      const { data: rows } = await supabaseAdmin.from("media").select("src, sm").in("src", srcs);
      const bySrc = new Map((rows ?? []).map((r) => [r.src, r.sm && r.sm !== r.src ? r.sm : r.src]));
      lacking.forEach((x) => { x.sm = bySrc.get(x.src) ?? x.src; });
      const patch: Record<string, unknown> = {};
      if (work) patch.featured_work = work;
      if (spotlight) patch.featured_spotlight = spotlight;
      await supabaseAdmin.from("site_settings").update(patch as never).eq("id", 1);
    } catch (e) {
      console.error("getHomeMedia backfill", e);
    }
  }
  return { hero, about, work, columns, columnsMobile, spotlight };
});
