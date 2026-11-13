import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { bioContacts, bioRealEstate, instagramHandle } from "@/content/bio-links";
import { defaultHero } from "@/content/home";
import { photos } from "@/lib/photos";
import { getHomeMedia, getSiteSettings } from "@/lib/portfolio.functions";
import { useI18n } from "@/lib/i18n";

const settingsOptions = queryOptions({ queryKey: ["site-settings"], queryFn: () => getSiteSettings() });

export const Route = createFileRoute("/links")({
  loader: async ({ context }) => {
    const [settings, home] = await Promise.all([
      context.queryClient.ensureQueryData(settingsOptions),
      getHomeMedia(),
    ]);
    return { settings, image: home.hero?.[0]?.src ?? photos[10]?.src ?? defaultHero[0]?.src };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "Gor Arsakjan — links" },
      { name: "description", content: "Gor Arsakjan — portfolio, real estate photography and contact links in Tallinn, Estonia." },
      { property: "og:title", content: "Gor Arsakjan — links" },
      { property: "og:description", content: "Gor Arsakjan — portfolio, real estate photography and contact links in Tallinn, Estonia." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.thegodnamed.ee/links" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.image?.startsWith("https://") ? [
        { property: "og:image", content: loaderData.image },
        { name: "twitter:image", content: loaderData.image },
      ] : []),
    ],
    links: [{ rel: "canonical", href: "https://www.thegodnamed.ee/links" }],
  }),
  component: LinksPage,
});

function RowContent({ title, description }: { title: ReactNode; description: ReactNode }) {
  return <>
    <span className="min-w-0">
      <span className="bio-title display block text-[31px] leading-none">{title}</span>
      <span className="mt-2 block text-[12.5px] leading-relaxed text-muted-foreground">{description}</span>
    </span>
    <span aria-hidden="true" className="bio-arrow shrink-0 text-xl text-muted-foreground">→</span>
  </>;
}

function LinksPage() {
  const { data: settings } = useSuspenseQuery(settingsOptions);
  const { t } = useI18n();
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const dot = cursor.current;
    if (!dot) return;
    const hide = () => { dot.hidden = true; };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") { hide(); return; }
      dot.hidden = false;
      dot.style.transform = `translate3d(${event.clientX - 6}px, ${event.clientY - 6}px, 0)`;
    };
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    media.addEventListener("change", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      media.removeEventListener("change", hide);
    };
  }, []);
  return (
    <main className="bio-page mx-auto min-h-svh w-full max-w-[480px] bg-background px-5 pb-10 pt-[22px] text-paper">
      <header className="flex items-center justify-between gap-4">
        <Link to="/" className="wordmark link-u">thegodnamed</Link>
        <span className="meta">{t("footer.city")}</span>
      </header>
      <h1 className="bio-heading display mt-11 text-center not-italic">{t("links.name")}</h1>
      <div className="meta mt-[22px] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-paper/25 pt-3">
        <span>{t("hero.tag")}</span><span>{t("hero.place")}</span>
      </div>
      <nav aria-label={t("links.portfolio")} className="mt-[34px]">
        <div className="border-t border-paper/14">
          <Link to="/" className="bio-row"><RowContent title={t("links.portfolio")} description={<><span className="wordmark bio-inline-wordmark">thegodnamed</span>.ee — {t("links.selected")}</>} /></Link>
          <a href={bioRealEstate} target="_blank" rel="noopener noreferrer" className="bio-row"><RowContent title={t("links.realEstate")} description={<>HŌRA Studios — {t("links.property")}</>} /></a>
        </div>
        <h2 className="meta pb-3 pt-7 text-muted-foreground">{t("nav.contact")}</h2>
        <div className="border-t border-paper/14">
          {bioContacts(settings).map((row) => <a key={row.title} href={row.href} target="_blank" rel="noopener noreferrer" className="bio-row">
            <RowContent title={row.title} description={row.description ? t(row.description) : instagramHandle(row.href)} />
          </a>)}
        </div>
      </nav>
      <footer className="meta mt-9 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-muted-foreground">
        <span>© {new Date().getFullYear()} <span className="wordmark bio-inline-wordmark">thegodnamed</span></span>
        <span>Beyond the obvious.</span>
      </footer>
      <div ref={cursor} aria-hidden="true" hidden className="bio-cursor" />
    </main>
  );
}