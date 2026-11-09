import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@/content/categories";

/** Sitemap for Google: home, every discipline, its archive and every published photoshoot. */
export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths: { p: string; mod?: string }[] = ["", "privacy", ...categories.flatMap((c) => [c.slug, `gallery/${c.slug}`])].map((p) => ({ p }));
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("photoshoots").select("id, category, updated_at").eq("status", "published");
          const latest = new Map<string, string>();
          (data ?? []).forEach((s) => {
            if (!categories.some((c) => c.slug === s.category)) return;
            paths.push({ p: `gallery/${s.category}/${s.id}`, mod: s.updated_at });
            if (!latest.get(s.category) || s.updated_at > latest.get(s.category)!) latest.set(s.category, s.updated_at);
          });
          // An archive page changes whenever one of its shoots does.
          paths.forEach((x) => { const cat = x.p.startsWith("gallery/") && x.p.split("/").length === 2 ? x.p.split("/")[1]! : null; const m = cat ? latest.get(cat) : undefined; if (m) x.mod = m; });
        } catch { /* main pages only */ }
        const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((x) => `<url><loc>${origin}/${x.p}</loc>${x.mod ? `<lastmod>${x.mod.slice(0, 10)}</lastmod>` : ""}</url>`).join("")}</urlset>`;
        return new Response(body, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
