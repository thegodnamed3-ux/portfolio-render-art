import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { VideoGallery } from "@/components/Gallery";
import { CollapseIcon, GlassPage, ShootCard } from "@/components/ArchiveParts";
import { getCategory, internalCategories } from "@/content/categories";
import { getPublishedSessions } from "@/lib/portfolio.functions";
import { FRAMES, useCategoryTitle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Archive: every shoot of a category, folded into small covers; a shoot opens on its own page. */
export const Route = createFileRoute("/gallery/$category")({
  loader: async ({ params }) => {
    const c = getCategory(params.category);
    if (!c) throw notFound();
    const sessions = c.videos.length ? [] : await getPublishedSessions({ data: { category: c.slug } });
    const shoots = sessions.map((s) => ({ id: s.id, title: s.title, cover: s.cover, count: s.images.length }));
    return { slug: c.slug, shoots, total: shoots.reduce((n, s) => n + s.count, 0), cover: sessions[0]?.cover.src ?? null };
  },
  head: ({ loaderData }) => {
    const c = loaderData ? getCategory(loaderData.slug) : undefined;
    return { meta: [{ title: c ? `Archive · ${c.title} — thegodnamed` : "Archive — thegodnamed" }] };
  },
  component: Archive,
});

function Archive() {
  const { slug, shoots, total, cover } = Route.useLoaderData();
  const c = getCategory(slug)!;
  const title = useCategoryTitle();
  const { t, p } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) void navigate({ to: "/", hash: "disciplines" }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const header = (
    <>
      {/* Everything in the header shares one left edge: label, title, pill text, the grid below. */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
        <div className="min-w-0">
          <p className="meta text-[0.625rem] text-paper/50 md:text-[0.6875rem]">
            {t("ar.title")}
            {total > 0 && <span> · {String(shoots.length).padStart(2, "0")} · {String(total).padStart(2, "0")} {p(total, FRAMES)}</span>}
          </p>
          <h1 className="display mt-1.5 truncate text-3xl leading-none md:mt-2 md:text-5xl">{title(c.slug, c.title)}.</h1>
        </div>
        <Link to="/" hash="disciplines" aria-label={t("ar.back")} title={t("ar.back")} className="glass hit inline-flex size-9 shrink-0 items-center justify-center rounded-full text-paper/80 hover:text-paper">
          <CollapseIcon />
        </Link>
      </div>
      <nav className="flex overflow-x-auto px-4 pb-3 pt-3 [scrollbar-width:none] md:px-8" aria-label={t("ar.cats")}>
        {internalCategories.map((x) => (
          <Link
            key={x.slug}
            to="/gallery/$category"
            params={{ category: x.slug }}
            replace
            aria-current={x.slug === slug ? "page" : undefined}
            className={cn("link-u meta mx-3 shrink-0 py-1.5 text-[0.625rem] first:ml-0", x.slug === slug ? "link-on text-paper" : "text-paper/55 hover:text-paper")}
          >
            {title(x.slug, x.title)}
          </Link>
        ))}
      </nav>
    </>
  );

  return (
    <GlassPage cover={cover} header={header}>
      <section key={slug} className="px-4 pb-16 pt-5 md:px-8 md:pt-8">
        {c.videos.length > 0 ? (
          <div className="px-1 pt-6 md:px-0"><VideoGallery videos={c.videos} /></div>
        ) : shoots.length ? (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 md:grid-cols-5 md:gap-x-4 md:gap-y-8 xl:grid-cols-6">
            {shoots.map((s, k) => (
              <ShootCard key={s.id} cover={s.cover} title={s.title} meta={`${String(s.count).padStart(2, "0")} ${p(s.count, FRAMES)}`} i={k}>
                {(inner) => (
                  <Link to="/gallery/$category/$shoot" params={{ category: slug, shoot: s.id }} className="block">
                    {inner}
                  </Link>
                )}
              </ShootCard>
            ))}
          </ul>
        ) : (
          <p className="meta py-24 text-center text-paper/40">{t("ar.none")}</p>
        )}
      </section>
    </GlassPage>
  );
}
