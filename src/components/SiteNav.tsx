import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LangSwitch, useI18n, type Key } from "@/lib/i18n";
import { internalCategories } from "@/content/categories";

/** `hash` items scroll the homepage; the Archive item opens the full-screen gallery. */
const ARCHIVE = "archive";
const archiveSlug = internalCategories[0]?.slug ?? "";
const links: { hash: string; key: Key }[] = [
  { hash: "work", key: "nav.work" },
  { hash: "disciplines", key: "nav.explore" },
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
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 md:h-32">
        {/* Only one wash exists at a time (no cross-faded layers): iOS Safari could leave a faded
            layer half-painted, which showed as a grey band over the paper sections. */}
        {!light && <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/55 via-45% to-transparent" />}
        {/* On paper the wash stays short, so section titles under the bar are not bleached. */}
        {light && <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-paper via-paper/80 via-45% to-transparent md:h-28" />}
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
          <DockMenu light={light} pathname={pathname} />
          <div className="flex items-center gap-4 md:hidden">
          <LangSwitch className="whitespace-nowrap text-[0.625rem]" />
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            aria-label={menu ? t("nav.closeMenu") : t("nav.openMenu")}
            // Same as desktop: the word Menu. / Close. no frame, no shade.
            className="hit relative isolate inline-grid shrink-0 place-items-end self-center px-1 py-1.5 text-[0.6875rem] md:hidden"
          >
            <span aria-hidden className={`col-start-1 row-start-1 transition-[opacity,filter] duration-500 ease-out ${menu ? "opacity-0 blur-[3px]" : "opacity-100 blur-0"}`}>{t("nav.menu")}</span>
            <span aria-hidden className={`col-start-1 row-start-1 transition-[opacity,filter] duration-500 ease-out ${menu ? "opacity-100 blur-0" : "opacity-0 blur-[3px]"}`}>{t("nav.close")}</span>
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

/**
 * Desktop menu. On the first screen of the homepage the items stand in a column on the right and
 * fade in one by one. Scrolling down (or pressing "—") flows them into one round glass button; the
 * button opens the same column again, items without any shade behind them.
 */
function DockMenu({ light, pathname }: { light: boolean; pathname: string }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const home = pathname === "/";
  const [atTop, setAtTop] = useState(true);
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => {
      const top = window.scrollY < window.innerHeight * 0.35;
      setAtTop(top);
      if (!top) setOpen(false);
      if (top && window.scrollY < 8) setTucked(false);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [pathname]);

  // Click outside or Escape closes an opened menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const resting = home && atTop && !tucked; // the big column on the first screen
  const shown = resting || open;
  const ease = [0.2, 0.8, 0.2, 1] as const;
  const close = () => { setOpen(false); if (resting) setTucked(true); };

  const item = (l: (typeof links)[number]) => {
    const cls = "link-u relative inline-block py-1.5";
    const label = (
      <>
        
        {t(l.key)}
      </>
    );
    return l.hash === ARCHIVE
      ? <Link to="/gallery/$category" params={{ category: archiveSlug }} onClick={() => setOpen(false)} className={cls}>{label}</Link>
      : <Link to="/" hash={l.hash} onClick={() => setOpen(false)} className={cls}>{label}</Link>;
  };

  return (
    <div ref={box} className="relative hidden md:block md:self-start">
      {/* The round button the column flows into. */}
      <AnimatePresence initial={false}>
        {!resting && (
          <motion.button
            key="dock"
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            // The button never swaps classes: glass and solid-ink layers (and their shades) cross-fade
            // slowly, and the lines stay paper-coloured, so passing a light band is a soft fade, not a blink.
            // No frame: just the word, no shade.
            className={`hit relative isolate inline-grid place-items-end px-1 py-2 text-[0.75rem] transition-colors duration-700 hover:opacity-60 ${light ? "text-ink" : "text-paper"}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : 0.18, ease }}
          >
            {/* Both words share one cell, so swapping Menu ↔ Close never shifts the layout. */}
            <span aria-hidden className={`col-start-1 row-start-1 transition-[opacity,filter] duration-500 ease-out ${open ? "opacity-0 blur-[3px]" : "opacity-100 blur-0"}`}>{t("nav.menu")}</span>
            <span aria-hidden className={`col-start-1 row-start-1 transition-[opacity,filter] duration-500 ease-out ${open ? "opacity-100 blur-0" : "opacity-0 blur-[3px]"}`}>{t("nav.close")}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shown && (
          <motion.ul
            key="column"
            className={`absolute right-0 flex flex-col items-end gap-1 text-right text-[0.75rem] ${resting ? "top-0" : "top-10"}`}
            initial="tucked"
            animate="shown"
            exit="tucked"
            variants={{
              shown: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.08 } },
              tucked: { transition: { staggerChildren: reduce ? 0 : 0.035, staggerDirection: -1 } },
            }}
          >
            {links.map((l, k) => (
              <motion.li
                key={l.hash}
                style={{ transformOrigin: "100% 0%" }}
                variants={{
                  shown: { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" },
                  // Each item shrinks toward the top-right corner, where the button lives.
                  tucked: { opacity: 0, x: 6, y: -10 - k * 14, scale: 0.55, filter: "blur(4px)" },
                }}
                transition={{ duration: reduce ? 0 : 0.5, ease }}
              >
                {item(l)}
              </motion.li>
            ))}
            <motion.li
              className="relative mt-2"
              variants={{ shown: { opacity: 1, y: 0 }, tucked: { opacity: 0, y: -60 } }}
              transition={{ duration: reduce ? 0 : 0.5, ease }}
            >
              
              <LangSwitch className="whitespace-nowrap px-1 py-1.5" />
            </motion.li>
            {resting && (
              <motion.li
                variants={{ shown: { opacity: 1 }, tucked: { opacity: 0 } }}
                transition={{ duration: reduce ? 0 : 0.4 }}
              >
                <button type="button" onClick={close} aria-label={t("nav.closeMenu")} title={t("nav.closeMenu")} className="hit mt-1 px-1 py-1 opacity-60 transition-opacity hover:opacity-100">—</button>
              </motion.li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
