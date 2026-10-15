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
