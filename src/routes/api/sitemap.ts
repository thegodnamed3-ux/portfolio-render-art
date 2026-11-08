import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@/content/categories";

/** Sitemap for Google: home, every discipline, its archive and every published photoshoot. */
export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths = ["", "privacy", ...categories.flatMap((c) => [c.slug, `gallery/${c.slug}`])];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("photoshoots").select("id, category").eq("status", "published");
          (data ?? []).forEach((s) => { if (categories.some((c) => c.slug === s.category)) paths.push(`gallery/${s.category}/${s.id}`); });
        } catch { /* main pages only */ }
        const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${origin}/${p}</loc></url>`).join("")}</urlset>`;
        return new Response(body, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
