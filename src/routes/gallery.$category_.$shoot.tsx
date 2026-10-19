import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CollapseIcon, GlassPage, PhotoTile } from "@/components/ArchiveParts";
import { originOf, useLightbox } from "@/components/Lightbox";
import { getCategory } from "@/content/categories";
import { getPublishedShoot } from "@/lib/portfolio.functions";
import { FRAMES, useCategoryTitle, useI18n } from "@/lib/i18n";

/** One shoot from the Archive, unfolded on its own full-screen glass page. */
export const Route = createFileRoute("/gallery/$category_/$shoot")({
  loader: async ({ params }) => {
    const c = getCategory(params.category);
    if (!c) throw notFound();
    const s = await getPublishedShoot({ data: { id: params.shoot } });
    if (!s || s.category !== c.slug) throw notFound();
    return { slug: c.slug, shoot: { id: s.id, title: s.title, photos: s.images, cover: s.cover.sm } };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.shoot.title} — thegodnamed` : "thegodnamed" }] }),
  component: Shoot,
});

function Shoot() {
  const { slug, shoot } = Route.useLoaderData();
  const c = getCategory(slug)!;
  const title = useCategoryTitle();
  const { t, p } = useI18n();
  const navigate = useNavigate();
  const { open } = useLightbox();
  const items = shoot.photos.map((ph) => ({ src: ph.full, w: ph.w, h: ph.h, alt: shoot.title }));
  const n = shoot.photos.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) void navigate({ to: "/gallery/$category", params: { category: slug } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, slug]);

  const header = (
    <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-4 md:px-8 md:pb-6 md:pt-6">
      <div className="min-w-0">
        <Link to="/gallery/$category" params={{ category: slug }} className="link-u hit meta inline-flex items-center gap-2 py-1 text-[0.625rem] text-paper/80 hover:text-paper">
          <span aria-hidden>←</span>{t("ar.title")} · {title(c.slug, c.title)}
        </Link>
        <h1 className="display mt-3 truncate text-3xl leading-none md:text-5xl">{shoot.title}</h1>
        <p className="meta mt-2 text-[0.625rem] text-paper/50">{[shoot.location, shoot.year, `${String(n).padStart(2, "0")} ${p(n, FRAMES)}`].filter(Boolean).join(" · ")}</p>
      </div>
      <Link to="/" hash="disciplines" aria-label={t("ar.back")} title={t("ar.back")} className="hit inline-flex size-9 shrink-0 items-center justify-center text-paper/75 transition-colors hover:text-paper">
        <CollapseIcon />
      </Link>
    </div>
  );

  return (
    <GlassPage cover={shoot.cover} header={header}>
      <section className="px-4 pb-16 pt-4 md:px-8 md:pt-8">
        <div className="columns-2 gap-2 md:columns-3 md:gap-3 xl:columns-4">
          {shoot.photos.map((ph, i) => (
            <PhotoTile key={`${ph.src}-${i}`} ph={ph} i={i} label={t("ar.open")} onOpen={(el) => open(items, i, shoot.title, { origin: originOf(el) })} />
          ))}
        </div>
      </section>
    </GlassPage>
  );
}
