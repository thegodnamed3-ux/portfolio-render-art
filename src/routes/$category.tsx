import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { SessionGrid, VideoGallery } from "@/components/Gallery";
import { useEffect } from "react";
import { usePortfolio } from "@/components/PortfolioOverlay";
import { SiteNav } from "@/components/SiteNav";
import { getCategory, internalCategories } from "@/content/categories";
import { getPublishedSessions } from "@/lib/portfolio.functions";
import { FILMS, FRAMES, useCategoryTitle, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/$category")({
  loader: async ({ params }) => {
    const c = getCategory(params.category);
    if (!c) throw notFound();
    const sessions = c.videos.length ? [] : await getPublishedSessions({ data: { category: c.slug } });
    return { slug: c.slug, sessions };
  },
  head: ({ loaderData }) => {
    const c = loaderData ? getCategory(loaderData.slug) : undefined;
    if (!c) return { meta: [{ title: "Not found — thegodnamed" }, { name: "robots", content: "noindex" }] };
    const title = `${c.title} — thegodnamed`;
    const image = loaderData?.sessions[0]?.cover.src ?? (c.videos[0] ? `https://i.ytimg.com/vi/${c.videos[0].id}/hqdefault.jpg` : undefined);
    return {
      meta: [
        { title },
        { name: "description", content: c.description },
        { property: "og:title", content: title },
        { property: "og:description", content: c.description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug, sessions } = Route.useLoaderData();
  const i = internalCategories.findIndex((c) => c.slug === slug);
  const c = internalCategories[i]!;
  const { openPortfolio } = usePortfolio();
  const { t, p } = useI18n();
  const title = useCategoryTitle()(c.slug, c.title);
  // Direct URLs initialise the same fullscreen explorer; the page stays underneath.
  useEffect(() => { openPortfolio(slug); }, [slug, openPortfolio]);
  const count = sessions.length || c.videos.length;

  return (
    <main>
      <SiteNav />
      <section className="px-5 pb-16 pt-36 md:px-10 md:pb-28 md:pt-56">
        <div className="flex items-end justify-between gap-6 border-b border-border pb-6">
          <h1 className="display reveal text-[clamp(3.2rem,12vw,9rem)] text-paper">{title}.</h1>
          <p className="meta shrink-0 pb-2 text-muted-foreground">
            {String(i + 1).padStart(2, "0")} / {String(internalCategories.length).padStart(2, "0")}
            {count > 0 && <span className="hidden md:inline"> · {count} {p(count, c.videos.length ? FILMS : FRAMES)}</span>}
          </p>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-10 md:pb-24">
        {c.videos.length > 0 ? <VideoGallery videos={c.videos} /> : sessions.length ? <SessionGrid sessions={sessions} /> : <p className="meta py-24 text-center text-muted-foreground">—</p>}
      </section>

      <footer className="meta flex items-center justify-between border-t border-border px-5 py-6 text-muted-foreground md:px-10">
        <Link to="/" className="wordmark text-paper">thegodnamed</Link>
        <Link to="/" hash="contact" className="hover:text-paper">{t("book.l1")} {t("book.l2").replace(/\.$/, "")}</Link>
      </footer>
    </main>
  );
}
