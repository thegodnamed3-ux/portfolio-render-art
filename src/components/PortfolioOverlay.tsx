import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { internalCategories } from "@/content/categories";
import type { Session } from "@/content/sessions";
import type { VideoItem } from "@/content/types";
import { getPublishedSessions } from "@/lib/portfolio.functions";
import { Viewer } from "./Lightbox";
import { FRAMES, useCategoryTitle, useI18n } from "@/lib/i18n";

/** One fullscreen glass overlay, two states: browse photoshoots → view one. Pages stay mounted underneath. */
type Ctx = { openPortfolio: (slug: string) => void };
const PortfolioContext = createContext<Ctx>({ openPortfolio: () => {} });
export const usePortfolio = () => useContext(PortfolioContext);

type Selected = { kind: "shoot"; s: Session } | { kind: "film"; v: VideoItem };

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const openPortfolio = useCallback((s: string) => setSlug(s), []);
  return (
    <PortfolioContext.Provider value={{ openPortfolio }}>
      {children}
      <AnimatePresence>{slug && <Overlay key="portfolio" initial={slug} onClose={() => setSlug(null)} />}</AnimatePresence>
    </PortfolioContext.Provider>
  );
}

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 stroke-current" strokeWidth="1.5" fill="none"><path d="M5 5l14 14M19 5 5 19" /></svg>
);

function Overlay({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { t, p } = useI18n();
  const catTitle = useCategoryTitle();
  const [cat, setCat] = useState(initial);
  const [cache, setCache] = useState<Record<string, Session[]>>({});
  const [selected, setSelected] = useState<Selected | null>(null);
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const c = internalCategories.find((x) => x.slug === cat) ?? internalCategories[0]!;
  const isVideo = c.videos.length > 0;
  const sessions = cache[cat];

  useEffect(() => {
    if (isVideo || cache[cat]) return;
    let alive = true;
    getPublishedSessions({ data: { category: cat } }).then((s) => alive && setCache((m) => ({ ...m, [cat]: s })));
    return () => { alive = false; };
  }, [cat, isVideo, cache]);

  // Lock background scroll; the page underneath stays mounted so its position is restored on close.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => { html.style.overflow = prev[0]!; document.body.style.overflow = prev[1]!; };
  }, []);

  // Escape in the explorer closes; the photo viewer handles its own Escape (→ back).
  useEffect(() => {
    if (selected?.kind === "shoot") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (selected ? setSelected(null) : onClose()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  const pick = (slug: string) => { setCat(slug); scroller.current?.scrollTo({ top: 0 }); };

  // Cues: scroll hint fades on first scroll; gesture guide shows once per visitor; stack demo once per opening.
  const [scrolled, setScrolled] = useState(false);
  const [guide, setGuide] = useState(false);
  const [demo, setDemo] = useState(false);
  const demoed = useRef(false);
  useEffect(() => {
    try { if (!localStorage.getItem("tgn-guide-seen")) setGuide(true); } catch { /* storage unavailable */ }
  }, []);
  const dismissGuide = useCallback(() => {
    setGuide(false);
    try { localStorage.setItem("tgn-guide-seen", "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (reduce || demoed.current || isVideo || !sessions?.length) return;
    const t = setTimeout(() => { if (!scrolled && !selected) { demoed.current = true; setDemo(true); } }, 900);
    return () => clearTimeout(t);
  }, [reduce, isVideo, sessions, scrolled, selected]);
  const onScroll = () => {
    if ((scroller.current?.scrollTop ?? 0) > 16 && !scrolled) { setScrolled(true); setDemo(false); if (guide) dismissGuide(); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[90] bg-viewer/70 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.1 : 0.3 }}
      style={{ padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={catTitle(c.slug, c.title)}
        className="glass-panel relative h-full w-full overflow-hidden rounded-[24px] text-paper md:mx-auto md:max-w-[1400px] md:rounded-[28px]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: reduce ? 0.1 : 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* State one — explorer. Kept mounted while viewing so category and scroll position survive. */}
        <motion.div
          className="absolute inset-0 flex flex-col"
          animate={selected ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0.1 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ pointerEvents: selected ? "none" : "auto" }}
          aria-hidden={!!selected}
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 md:px-8 md:pt-6">
            <h2 className="display text-3xl md:text-5xl">{catTitle(c.slug, c.title)}.</h2>
            <div className="flex shrink-0 items-center gap-2">
              {/* Full screen: the same explorer as its own page, every photo at once. */}
              <Link
                to="/gallery/$category"
                params={{ category: cat }}
                onClick={onClose}
                aria-label="Open full screen"
                title="Full screen"
                className="glass hit inline-flex size-9 items-center justify-center rounded-full text-paper/80 hover:text-paper"
              >
                <ExpandIcon />
              </Link>
              <button onClick={onClose} aria-label="Close portfolio" className="glass hit inline-flex size-9 shrink-0 items-center justify-center rounded-full text-paper/80 hover:text-paper"><CloseIcon /></button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] md:px-7">
            {internalCategories.map((x) => (
              <button
                key={x.slug}
                onClick={() => pick(x.slug)}
                aria-pressed={x.slug === cat}
                className={`meta shrink-0 rounded-full px-3 py-1.5 text-[0.625rem] transition-colors ${x.slug === cat ? "bg-paper/15 text-paper" : "text-paper/55 hover:text-paper"}`}
              >
                {catTitle(x.slug, x.title)}
              </button>
            ))}
          </div>
          <div className="mx-4 h-px bg-paper/10 md:mx-8" />

          <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 md:px-8">
            <div key={cat} className="grid gap-10 md:grid-cols-3 md:gap-x-8 md:gap-y-14">
              {isVideo
                ? c.videos.map((v, i) => (
                    <Cover key={v.id} i={i} title={v.title} meta={t("pf.film")} onSelect={() => setSelected({ kind: "film", v })}>
                      <div className="aspect-video overflow-hidden rounded-[14px] bg-charcoal">
                        <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt={v.title} loading="lazy" className="h-full w-full object-cover" />
                      </div>
                    </Cover>
                  ))
                : sessions?.map((s, i) => (
                    <Cover key={s.id} i={i} title={s.title} meta={`${String(s.count).padStart(2, "0")} ${p(s.count, FRAMES)}`} onSelect={() => setSelected({ kind: "shoot", s })}>
                      <StackPreview s={s} eager={i < 2} demo={demo && i === 0} />
                    </Cover>
                  ))}
            </div>
            {!isVideo && sessions && sessions.length === 0 && <p className="meta py-24 text-center text-paper/40">{t("pf.none")}</p>}
            {!isVideo && !sessions && <p className="meta py-24 text-center text-paper/40">{t("pf.loading")}</p>}
          </div>

          <AnimatePresence>
            {!scrolled && guide && !isVideo && (sessions?.length ?? 0) > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4">
                <span className="meta text-[0.625rem] tracking-[0.28em] text-paper/60">{t("pf.scroll")}</span>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>

        {/* State two — the same glass surface becomes the viewer. */}
        <AnimatePresence>
          {selected?.kind === "shoot" && (
            <Viewer
              key={selected.s.id}
              embedded
              items={selected.s.images.map((p) => ({ src: p.full, w: p.w, h: p.h, alt: selected.s.title }))}
              index={0}
              title={selected.s.title}
              onBack={() => setSelected(null)}
              onClose={onClose}
            />
          )}
          {selected?.kind === "film" && (
            <motion.div
              key={selected.v.id}
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-4 md:px-8 md:py-6">
                <div className="flex min-w-0 items-center gap-2">
                  <button onClick={() => setSelected(null)} aria-label="Back to projects" className="glass hit meta inline-flex h-9 items-center rounded-full px-3.5 text-paper/80 hover:text-paper">{t("pf.back")}</button>
                  <span className="glass meta truncate rounded-full px-3.5 py-1.5 text-paper">{selected.v.title}</span>
                </div>
                <button onClick={onClose} aria-label="Close portfolio" className="glass hit inline-flex size-9 items-center justify-center rounded-full text-paper/80 hover:text-paper"><CloseIcon /></button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-8 md:px-10">
                <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-[14px] bg-charcoal">
                  <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${selected.v.id}?autoplay=1&rel=0`} title={selected.v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function Cover({ i, title, meta, onSelect, children }: { i: number; title: string; meta: string; onSelect: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className="group block w-full text-left"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.55, delay: Math.min(i, 8) * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
      <span className="meta mt-3 flex items-center justify-between gap-3 text-paper/55">
        <span className="min-w-0 truncate text-paper">{title}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5">{meta}<span aria-hidden className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span></span>
      </span>
    </motion.button>
  );
}

/** Straight stack preview: depth via translation only, never rotation. */
function StackPreview({ s, eager, demo }: { s: Session; eager: boolean; demo: boolean }) {
  const under = s.images.slice(1, 3);
  return (
    <div className="pb-[12px] pr-[12px]">
      <div className="relative" style={{ aspectRatio: `${s.cover.w} / ${s.cover.h}` }}>
        {under.map((p, k) => (
          <div key={k} aria-hidden className="absolute inset-0 overflow-hidden rounded-[12px] bg-charcoal" style={{ transform: `translate(${(under.length - k) * 6}px, ${(under.length - k) * 6}px)`, zIndex: k }}>
            <img src={p.sm} alt="" loading="lazy" className={`h-full w-full object-cover transition-[filter] duration-500 ${demo ? "brightness-[0.85]" : "brightness-[0.55]"}`} />
          </div>
        )).reverse()}
        <motion.div
          className="absolute inset-0 z-10"
          animate={demo ? { x: [0, 18, 0] } : { x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", times: [0, 0.45, 1] }}
        >
        <div className="absolute inset-0 overflow-hidden rounded-[12px] bg-charcoal shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)] transition-transform duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1">
          <img src={s.cover.src} srcSet={`${s.cover.sm} 600w, ${s.cover.src} 1240w`} sizes="(min-width: 768px) 30vw, 90vw" alt={s.title} loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
        </div>
        </motion.div>
      </div>
    </div>
  );
}
