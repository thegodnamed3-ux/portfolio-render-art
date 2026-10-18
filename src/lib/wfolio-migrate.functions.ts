import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moves every photo still served from Wfolio's CDN into the project's own private
 * `portfolio` bucket, so the site survives the Wfolio subscription ending.
 * Runs in small batches (driven by the studio) to stay inside worker limits; each
 * batch is idempotent — finished rows no longer match and are never copied twice.
 */

const BUCKET = "portfolio";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const isWfolio = (u: unknown): u is string => typeof u === "string" && /(^|\/\/)([a-z0-9-]+\.)*wfolio\.(com|pro)\//i.test(u);
/** Rows still on Wfolio's servers. Matches the host ("wfolio.com/", "wfolio.pro/"), never our
 *  own copies, which sit in a "wfolio/" folder of the bucket and would otherwise loop forever. */
const WFOLIO_HOSTS = ["src", "full_src", "sm"].flatMap((c) => [`${c}.ilike.%wfolio.com/%`, `${c}.ilike.%wfolio.pro/%`]).join(",");
const abs = (u: string) => (u.startsWith("//") ? `https:${u}` : u);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

async function copy(sb: any, url: string, path: string): Promise<string> {
  const res = await fetch(abs(url));
  if (!res.ok) throw new Error(`Wfolio answered ${res.status}`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const body = await res.arrayBuffer();
  const up = await sb.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: "31536000", upsert: true });
  if (up.error) throw new Error(up.error.message);
  const signed = await sb.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signed.error) throw new Error(signed.error.message);
  return signed.data.signedUrl as string;
}

/** How much is left: media rows and homepage images still pointing at Wfolio. */
export const wfolioMigrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { count } = await sb.from("media").select("id", { count: "exact", head: true }).or(WFOLIO_HOSTS);
    const { data: s } = await sb.from("site_settings").select("hero_slides, about_image, featured_work").eq("id", 1).maybeSingle();
    const { data: sp } = await sb.from("site_settings").select("featured_spotlight").eq("id", 1).maybeSingle();
    const settings = JSON.stringify(s ?? {}) + JSON.stringify(sp ?? {});
    const settingsLeft = (settings.match(/wfolio\.(com|pro)\//g) ?? []).length;
    const settingsMissing = !s || !s.hero_slides || !s.about_image || !s.featured_work;
    return { media: count ?? 0, settings: settingsLeft, settingsMissing };
  });

/** Copies up to `batch` media rows (all three sizes) and swaps their links. */
export const migrateWfolioMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batch?: number; skip?: string[] }) => ({
    batch: Math.max(1, Math.min(6, Number(input?.batch) || 3)),
    skip: Array.isArray(input?.skip) ? input.skip.filter((x) => typeof x === "string").slice(0, 500) : [],
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    let q = sb.from("media").select("id, sm, src, full_src").or(WFOLIO_HOSTS).order("created_at").limit(data.batch);
    if (data.skip.length) q = q.not("id", "in", `(${data.skip.join(",")})`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const failed: { id: string; error: string }[] = [];
    let done = 0;
    for (const m of rows ?? []) {
      try {
        // Same picture at three widths; reuse a copy when two sizes share one URL.
        const made = new Map<string, string>();
        const get = async (u: string, name: string) => {
          if (!isWfolio(u)) return u;
          if (!made.has(u)) made.set(u, await copy(sb, u, `wfolio/${m.id}-${name}.jpg`));
          return made.get(u)!;
        };
        const full = await get(m.full_src, "full");
        const src = await get(m.src, "src");
        const smv = await get(m.sm, "sm");
        const { error: e } = await sb.from("media").update({ full_src: full, src, sm: smv, storage_path: `wfolio/${m.id}-full.jpg` }).eq("id", m.id);
        if (e) throw new Error(e.message);
        done++;
      } catch (e) {
        failed.push({ id: m.id, error: (e as Error).message });
      }
    }
    return { done, failed };
  });

/**
 * Homepage images (hero slides, About portrait, Selected works). Code defaults are
 * written into the settings first, so after this the site never reaches Wfolio.
 */
export const migrateWfolioSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { defaultHero, defaultAbout, defaultWork } = await import("@/content/home");
    const { data: s } = await sb.from("site_settings").select("hero_slides, about_image, featured_work").eq("id", 1).maybeSingle();

    const hero = (Array.isArray(s?.hero_slides) && s.hero_slides.length ? s.hero_slides : defaultHero) as { src: string }[];
    const about = (s?.about_image && typeof s.about_image === "object" ? s.about_image : defaultAbout) as { src: string };
    const work = (Array.isArray(s?.featured_work) && s.featured_work.length ? s.featured_work : defaultWork) as { src: string }[];

    const cache = new Map<string, string>();
    let n = 0;
    const move = async <T extends { src: string }>(img: T): Promise<T> => {
      if (!isWfolio(img.src)) return img;
      if (!cache.has(img.src)) cache.set(img.src, await copy(sb, img.src, `wfolio/home/${crypto.randomUUID()}.jpg`));
      n++;
      return { ...img, src: cache.get(img.src)! };
    };
    const nextHero = [];
    for (const h of hero) nextHero.push(await move(h));
    const nextAbout = await move(about);
    const nextWork = [];
    for (const w of work) nextWork.push(await move(w));

    const { error } = await sb.from("site_settings").upsert({
      id: 1,
      hero_slides: nextHero as never,
      about_image: nextAbout as never,
      featured_work: nextWork as never,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    // Spotlight (newer column; skipped quietly if it doesn't exist yet).
    const { data: sp, error: spErr } = await sb.from("site_settings").select("featured_spotlight").eq("id", 1).maybeSingle();
    if (!spErr && Array.isArray(sp?.featured_spotlight) && sp.featured_spotlight.length) {
      const next = [];
      for (const w of sp.featured_spotlight as { src: string; sm?: string }[]) {
        const moved = await move(w);
        next.push(moved.sm && isWfolio(moved.sm) ? { ...moved, sm: moved.src } : moved);
      }
      await sb.from("site_settings").update({ featured_spotlight: next as never }).eq("id", 1);
    }
    return { moved: n };
  });
