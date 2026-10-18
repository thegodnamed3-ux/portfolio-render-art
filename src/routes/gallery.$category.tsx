import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { VideoGallery } from "@/components/Gallery";
import { useFadeIn } from "@/components/Frame";
import { originOf, useLightbox } from "@/components/Lightbox";
import { getCategory, internalCategories } from "@/content/categories";
import type { GalleryPhoto } from "@/content/types";
import { getPublishedSessions } from "@/lib/portfolio.functions";
import { FRAMES, useCategoryTitle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Full-screen version of the glass explorer: every photo of a category on one glass page. */
export const Route = createFileRoute("/gallery/$category")({
  loader: async ({ params }) => {
    const c = getCategory(params.category);
    if (!c) throw notFound();
    const sessions = c.videos.length ? [] : await getPublishedSessions({ data: { category: c.slug } });
    // Grouped by shoot, in the studio's order.
    const shoots = sessions.map((s) => ({ id: s.id, title: s.title, photos: s.images.map((p) => ({ ...p, project: s.title })) }));
    return { slug: c.slug, shoots, total: shoots.reduce((n, s) => n + s.photos.length, 0), cover: sessions[0]?.cover.src ?? null };
  },
  head: ({ loaderData }) => {
    const c = loaderData ? getCategory(loaderData.slug) : undefined;
    return { meta: [{ title: c ? `Archive · ${c.title} — thegodnamed` : "Archive — thegodnamed" }] };
  },
  component: FullGallery,
});

const CollapseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6M10 14l-6.5 6.5M20 10h-6V4M14 10l6.5-6.5" />
  </svg>
);

function FullGallery() {
  const { slug, shoots, total, cover } = Route.useLoaderData();
  const c = getCategory(slug)!;
  const title = useCategoryTitle();
  const { t, p } = useI18n();
  const navigate = useNavigate();
  const { open } = useLightbox();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) void navigate({ to: "/", hash: "disciplines" }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main className="relative min-h-[100svh] bg-background text-paper">
      {/* The category's first photo, blurred, sits behind the glass. */}
      {cover && <img src={cover} alt="" aria-hidden className="fixed inset-0 h-full w-full scale-110 object-cover opacity-60 blur-3xl" />}
      <div className="glass-panel relative min-h-[100svh] !rounded-none !border-0">
        <header className="sticky top-0 z-20 border-b border-paper/10 bg-charcoal/40 backdrop-blur-2xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-6">
            <div className="flex min-w-0 items-baseline gap-4">
              <h1 className="display truncate text-3xl md:text-5xl">
                <span className="meta mr-3 align-middle text-[0.625rem] text-paper/50 md:text-[0.6875rem]">{t("ar.title")}</span>
                {title(c.slug, c.title)}.
              </h1>
              {total > 0 && <span className="meta hidden shrink-0 text-paper/50 sm:inline">{String(total).padStart(2, "0")} {p(total, FRAMES)}</span>}
            </div>
            <Link to="/" hash="disciplines" aria-label={t("ar.back")} title={t("ar.back")} className="glass hit inline-flex size-9 shrink-0 items-center justify-center rounded-full text-paper/80 hover:text-paper">
              <CollapseIcon />
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 pt-2 [scrollbar-width:none] md:px-7" aria-label={t("ar.cats")}>
            {internalCategories.map((x) => (
              <Link
                key={x.slug}
                to="/gallery/$category"
                params={{ category: x.slug }}
                replace
                aria-current={x.slug === slug ? "page" : undefined}
                className={cn("meta shrink-0 rounded-full px-3 py-1.5 text-[0.625rem] transition-colors", x.slug === slug ? "bg-paper/15 text-paper" : "text-paper/55 hover:text-paper")}
              >
                {title(x.slug, x.title)}
              </Link>
            ))}
          </nav>
        </header>

        <section key={slug} className="px-3 pb-16 pt-4 md:px-8 md:pt-8">
          {c.videos.length > 0 ? (
            <div className="px-1 pt-6 md:px-0"><VideoGallery videos={c.videos} /></div>
          ) : shoots.length ? (
            <div className="space-y-14 md:space-y-24">
              {shoots.map((s, k) => {
                const items = s.photos.map((ph) => ({ src: ph.full, w: ph.w, h: ph.h, alt: s.title }));
                return (
                  <section key={s.id} aria-labelledby={`shoot-${s.id}`}>
                    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-paper/10 px-1 pb-3 md:mb-6 md:px-0">
                      <h2 id={`shoot-${s.id}`} className="display truncate text-2xl md:text-4xl">{s.title}</h2>
                      <span className="meta shrink-0 text-paper/50">{String(k + 1).padStart(2, "0")} · {String(s.photos.length).padStart(2, "0")} {p(s.photos.length, FRAMES)}</span>
                    </div>
                    <div className="columns-2 gap-2 md:columns-3 md:gap-3 xl:columns-4">
                      {s.photos.map((ph, i) => (
                        <Tile key={`${ph.src}-${i}`} ph={ph} i={i} label={t("ar.open")} onOpen={(el) => open(items, i, s.title, { origin: originOf(el) })} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="meta py-24 text-center text-paper/40">{t("ar.none")}</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Tile({ ph, i, label, onOpen }: { ph: GalleryPhoto & { project: string }; i: number; label: string; onOpen: (el: Element) => void }) {
  const fade = useFadeIn();
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${label} ${i + 1} · ${ph.project}`}
      className="group mb-2 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-[12px] bg-charcoal md:mb-3"
      style={{ aspectRatio: `${ph.w} / ${ph.h}` }}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <img
        ref={fade.ref}
        onLoad={fade.onLoad}
        onError={fade.onError}
        data-fade=""
        src={ph.sm}
        srcSet={`${ph.sm} 600w, ${ph.src} 1240w`}
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
        alt={ph.project}
        width={ph.w}
        height={ph.h}
        loading={i < 8 ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-full w-full object-cover [transition:opacity_500ms_ease-out,transform_900ms_cubic-bezier(0.2,0.7,0.1,1)] group-hover:scale-[1.03]",
          fade.loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </motion.button>
  );
}
