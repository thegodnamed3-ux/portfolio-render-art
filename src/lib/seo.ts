import { translateKey, type Lang } from "@/lib/i18n";

type Head = { meta?: Record<string, string>[]; links?: Record<string, string>[] };
type Ctx = { matches?: { loaderData?: unknown }[]; match?: { pathname?: string } };

/** Page titles and descriptions in Estonian and Russian (everything else stays as written). */
const T: Record<string, [et: string, ru: string]> = {
  "Photography & film in Tallinn": ["Fotograafia ja video Tallinnas", "Фото и видео в Таллине"],
  "Photography, film & visual storytelling. Made in Tallinn.": ["Fotograafia, video ja visuaalne lugude jutustamine. Tehtud Tallinnas.", "Фотография, видео и визуальные истории. Сделано в Таллине."],
  "Photography, film & visual storytelling, made in Tallinn.": ["Fotograafia, video ja visuaalne lugude jutustamine. Tehtud Tallinnas.", "Фотография, видео и визуальные истории. Сделано в Таллине."],
  "Privacy policy": ["Privaatsuspoliitika", "Политика конфиденциальности"],
  "How thegodnamed (Gor Arsakjan, Tallinn) handles personal data.": ["Kuidas thegodnamed (Gor Arsakjan, Tallinn) isikuandmeid käsitleb.", "Как thegodnamed (Гор Арсакян, Таллин) обращается с персональными данными."],
  "Archive": ["Arhiiv", "Архив"],
  "Not found": ["Lehte ei leitud", "Страница не найдена"],
};

function rootInfo(ctx: Ctx): { lang: Lang; origin: string } {
  const d = ctx.matches?.[0]?.loaderData as { lang?: unknown; origin?: unknown } | string | undefined;
  const raw = typeof d === "string" ? d : d?.lang;
  const lang: Lang = raw === "et" || raw === "ru" ? raw : "en";
  return { lang, origin: typeof d === "object" && d && typeof d.origin === "string" ? d.origin : "" };
}

/**
 * Page title / description in the visitor's language, plus links telling Google the page exists in
 * English, Estonian and Russian, a canonical address, og:locale/url/site name and — for pages
 * without their own — a preview picture. `categorySlug` translates a discipline's name.
 */
export function withLang(ctx: Ctx, head: Head, opts: { categorySlug?: string; categoryTitle?: string; image?: string } = {}): Head {
  const { lang, origin } = rootInfo(ctx);
  const tr = (s: string) => {
    if (lang === "en") return s;
    const i = lang === "et" ? 0 : 1;
    const parts = s.split(" — ");
    const out = parts.map((p) => {
      if (opts.categorySlug && opts.categoryTitle && p.includes(opts.categoryTitle)) return p.replace(opts.categoryTitle, translateKey(lang, `cat.${opts.categorySlug}`, opts.categoryTitle)).replace("Archive", T["Archive"]![i]);
      return T[p]?.[i] ?? p;
    });
    return out.join(" — ");
  };
  const meta = (head.meta ?? []).map((m) => (m["title"] ? { ...m, title: tr(m["title"]) } : m["content"] && ["description", "og:title", "og:description"].includes(m["name"] ?? m["property"] ?? "") ? { ...m, content: tr(m["content"]) } : m));
  meta.push({ property: "og:locale", content: lang === "et" ? "et_EE" : lang === "ru" ? "ru_RU" : "en_GB" });
  const path = ctx.match?.pathname ?? "/";
  if (origin) {
    meta.push({ property: "og:url", content: `${origin}${path}` }, { property: "og:site_name", content: "thegodnamed" });
    const img = opts.image;
    if (img && !meta.some((m) => m["property"] === "og:image")) meta.push({ property: "og:image", content: img }, { name: "twitter:image", content: img });
  }
  const links = origin ? [
    ...(["en", "et", "ru"] as const).map((l) => ({ rel: "alternate", hrefLang: l, href: `${origin}${path}?lang=${l}` })),
    { rel: "alternate", hrefLang: "x-default", href: `${origin}${path}` },
    { rel: "canonical", href: `${origin}${path}${lang === "en" ? "" : `?lang=${lang}`}` },
  ] : [];
  return { ...head, meta, links: [...(head.links ?? []), ...links] };
}
