import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LangSwitch, useI18n, type Key } from "@/lib/i18n";
import { internalCategories } from "@/content/categories";

/** `hash` items scroll the homepage; the Archive item opens the full-screen gallery. */
const ARCHIVE = "archive";
const archiveSlug = internalCategories[0]?.slug ?? "";
const links: { hash: string; key: Key }[] = [
  { hash: "work", key: "nav.work" },
  { hash: "disciplines", key: "nav.explore" },
  { hash: ARCHIVE, key: "nav.archive" },
  { hash: "about", key: "nav.about" },
  { hash: "contact", key: "nav.contact" },
];

export function SiteNav() {
  const { t } = useI18n();
  const [overLight, setOverLight] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const update = () => {
      const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-light]"));
      setOverLight(bands.some((el) => { const r = el.getBoundingClientRect(); return r.top < 112 && r.bottom > 0; }));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menu]);

  const light = overLight && !menu;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 md:h-80">
        <div className={`absolute inset-0 bg-gradient-to-b from-background via-background via-40% to-transparent transition-opacity duration-500 md:via-30% ${light ? "opacity-0" : "opacity-100"}`} />
        <div className={`absolute inset-0 bg-gradient-to-b from-paper via-paper via-40% to-transparent transition-opacity duration-500 md:via-30% ${light ? "opacity-100" : "opacity-0"}`} />
      </div>
      <nav className={`meta relative px-5 py-4 transition-colors duration-500 md:px-10 md:py-6 ${light ? "text-ink" : "text-paper"}`}>
        <div className="flex items-center justify-between gap-4 md:items-baseline">
          <Link
            to="/"
            hash="top"
            onClick={() => setMenu(false)}
            aria-label="thegodnamed"
            className="inline-flex flex-col items-center whitespace-nowrap transition-opacity hover:opacity-60"
          >
            <span className="wordmark">thegodnamed</span>
            <span
              className={`-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] transition-colors duration-500 md:mt-1 md:text-[0.5625rem] ${light ? "text-ink/75" : "text-paper/85"}`}
            >
              PHOTOGRAPHY · VISUALS
            </span>
          </Link>
          <div className="hidden items-center gap-8 text-[0.6875rem] md:flex">
            {links.map((l) => (
              l.hash === ARCHIVE
                ? <Link key={l.hash} to="/gallery/$category" params={{ category: archiveSlug }} className="transition-opacity hover:opacity-60">{t(l.key)}</Link>
                : <Link key={l.hash} to="/" hash={l.hash} className="transition-opacity hover:opacity-60">{t(l.key)}</Link>
            ))}
            <span aria-hidden className="ml-2 h-3 w-px self-center bg-current opacity-30" />
            <LangSwitch className="whitespace-nowrap" />
          </div>
          <div className="flex items-center gap-4 md:hidden">
          <LangSwitch className="whitespace-nowrap text-[0.625rem]" />
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            aria-label={menu ? t("nav.closeMenu") : t("nav.openMenu")}
            className={`hit -my-1 inline-flex size-8 shrink-0 items-center justify-center self-center rounded-full md:hidden ${light ? "glass-ink" : "glass"}`}
          >
            <span aria-hidden className="relative block h-2 w-3.5">
              <span className={`absolute left-0 h-px w-full bg-current transition-transform duration-300 ${menu ? "top-1 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-px w-full bg-current transition-transform duration-300 ${menu ? "top-1 -rotate-45" : "top-2"}`} />
            </span>
          </button>
          </div>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`fixed inset-0 -z-10 flex flex-col justify-end bg-background px-5 pb-10 transition-opacity duration-300 md:hidden ${menu ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ul className="border-t border-border">
          {links.map((l, i) => (
            <li key={l.hash} className="border-b border-border">
              {(() => {
                const inner = (
                  <>
                    <span className="display text-5xl">{t(l.key)}</span>
                    <span className="meta text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  </>
                );
                const cls = "flex items-baseline justify-between py-5 text-paper";
                return l.hash === ARCHIVE
                  ? <Link to="/gallery/$category" params={{ category: archiveSlug }} onClick={() => setMenu(false)} className={cls} tabIndex={menu ? 0 : -1}>{inner}</Link>
                  : <Link to="/" hash={l.hash} onClick={() => setMenu(false)} className={cls} tabIndex={menu ? 0 : -1}>{inner}</Link>;
              })()}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
