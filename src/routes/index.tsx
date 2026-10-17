import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Frame } from "@/components/Frame";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/components/PortfolioOverlay";
import { ContactSection } from "@/components/ContactSection";
import { useLightbox } from "@/components/Lightbox";
import { SiteNav } from "@/components/SiteNav";
import { categories } from "@/content/categories";
import type { Category } from "@/content/categories";
import { photos } from "@/lib/photos";
import { getHomeMedia, type HomeImage } from "@/lib/portfolio.functions";
import { defaultHero, defaultAbout, defaultWork, defaultWorkColumns, type WorkItem } from "@/content/home";
import { WorkGrid } from "@/components/WorkGrid";
import { useCategoryTitle, useI18n } from "@/lib/i18n";
import { HeroSlideshow } from "@/components/HeroSlideshow";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => ({
    meta: [
      { title: "thegodnamed — Photography & film in Tallinn" },
      { name: "description", content: "Photography, film & visual storytelling. Made in Tallinn." },
      { property: "og:title", content: "thegodnamed — Photography & film in Tallinn" },
      { property: "og:description", content: "Photography, film & visual storytelling. Made in Tallinn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: loaderData?.hero?.[0]?.src ?? photos[10]!.src },
      { name: "twitter:image", content: loaderData?.hero?.[0]?.src ?? photos[10]!.src },
    ],
  }),
  loader: () => getHomeMedia(),
  component: Index,
});

const p = (n: number) => photos[n - 1]!;
const num = (n: number) => String(n).padStart(2, "0");


function Hero({ slides }: { slides: HomeImage[] }) {
  // The slide arrows are rendered into the headline row, so they share its bottom edge.
  const [arrows, setArrows] = useState<HTMLDivElement | null>(null);
  const { t } = useI18n();
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden">
      <HeroSlideshow slides={slides} controlsContainer={arrows} />
      <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-background via-background/60 to-transparent md:h-3/4 md:via-background/50" />
      <div className="pointer-events-none relative flex min-h-[100svh] flex-col justify-end px-5 pb-5 md:px-10 md:pb-8">
        <div className="flex items-end justify-between gap-4">
          <h1
            className="display reveal text-[clamp(2.75rem,11vw,8rem)] leading-[0.92] text-paper"
            style={{ animationDelay: "0.14s" }}
          >
            <span className="block">{t("hero.l1")}</span>
            <span className="block md:pl-[0.6em]">
              {t("hero.l2a") && <>{t("hero.l2a")} </>}<em>{t("hero.l2b")}</em>
            </span>
          </h1>
          <div ref={setArrows} className="pointer-events-auto relative z-10 shrink-0" />
        </div>
        <div className="meta mt-5 flex items-baseline justify-between gap-4 border-t border-paper/25 pt-4 text-paper/70 md:mt-8">
          <span>{t("hero.place")}</span>
          <span className="hidden md:inline">{t("hero.tag")}</span>
          <a href="#work" className="pointer-events-auto transition-colors hover:text-paper">{t("hero.scroll")}</a>
        </div>
      </div>
    </section>
  );
}

function Work({ items, columns }: { items: WorkItem[]; columns: number }) {
  const { t } = useI18n();
  return (
    <section id="work" className="px-5 pb-20 pt-24 md:px-10 md:pb-32 md:pt-36">
      <div className="mb-10 grid gap-6 md:mb-16 md:grid-cols-12">
        <h2 className="display text-3xl md:col-span-3 md:text-4xl">{t("work.title")}</h2>
        <p className="display text-4xl md:col-span-9 md:text-6xl">
          {t("work.lead1")} <em className="text-muted-foreground">{t("work.lead2")}</em>
        </p>
      </div>
      <WorkGrid items={items} columns={columns} />
    </section>
  );
}

function DisciplineRow({ c, n }: { c: Category; n: string }) {
  const title = useCategoryTitle()(c.slug, c.title);
  const inner = (
    <>
      <span className="flex items-center gap-3 md:gap-5">
        <span className="display text-4xl transition-transform duration-300 group-hover:translate-x-2 md:text-6xl">
          {title}
        </span>
        {c.external && (
          <ArrowUpRight
            strokeWidth={1.25}
            aria-hidden
            className="size-4 shrink-0 text-ink-muted transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 md:size-7"
          />
        )}
      </span>
      <span className="meta text-ink-muted">{n}</span>
    </>
  );
  const { openPortfolio } = usePortfolio();
  const cls = "group flex items-baseline justify-between py-5 md:py-7";

  return c.external ? (
    <a
      href={c.external}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      aria-label={`${title} ↗`}
    >
      {inner}
    </a>
  ) : (
    <a href={`/${c.slug}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openPortfolio(c.slug); }} className={cls}>
      {inner}
    </a>
  );
}

function Index_Disciplines() {
  const { t } = useI18n();
  return (
    <section id="disciplines" data-nav-light className="scroll-mt-0 bg-paper px-5 py-14 text-ink md:px-10 md:py-20">
      <div className="grid gap-10 md:grid-cols-12">
        <h2 className="display text-3xl md:col-span-3 md:text-4xl">{t("disciplines.title")}</h2>
        <ol className="md:col-span-9">
          {categories.map((c, i) => (
            <li key={c.slug} className="border-t border-ink/15 last:border-b">
              <DisciplineRow c={c} n={num(i + 1)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function About({ image }: { image: HomeImage }) {
  const { t } = useI18n();
  return (
    <section id="about" className="relative isolate flex min-h-[68svh] flex-col justify-between overflow-hidden px-5 py-14 md:min-h-[70vh] md:px-10 md:py-20">
      <img
        src={image.src}
        alt="Portrait of Gor Arsakjan"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full max-w-none object-cover"
        style={{ objectPosition: image.pos ?? "50% 50%" }}
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background/90 via-background/30 to-background/50" />
      <h2 className="display text-3xl text-paper md:text-4xl">{t("about.title")}</h2>
      <div>
        <p className="display text-4xl text-paper md:text-6xl">Gor Arsakjan.</p>
        <p className="meta mt-5 text-paper/75">{t("about.role")}</p>
      </div>
    </section>
  );
}


function Index() {
  const { hero, about, work, columns } = Route.useLoaderData();
  return (
    <main>
      <SiteNav />
      <Hero slides={hero ?? defaultHero} />
      <Work items={work ?? defaultWork} columns={columns ?? defaultWorkColumns} />
      <Index_Disciplines />
      <About image={about ?? defaultAbout} />
      <ContactSection id="contact" />
    </main>
  );
}
