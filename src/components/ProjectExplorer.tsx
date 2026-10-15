import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { internalCategories } from "@/content/categories";
import type { Session } from "@/content/sessions";
import { getPublishedSessions } from "@/lib/portfolio.functions";
import { useLightbox } from "./Lightbox";

/** Compact floating glass panel for browsing categories and opening photoshoot stacks in place. */
export function ProjectExplorer({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(current);
  const [cache, setCache] = useState<Record<string, Session[]>>({});
  const [loading, setLoading] = useState(false);
  const lb = useLightbox();
  const panel = useRef<HTMLDivElement>(null);

  const c = internalCategories.find((x) => x.slug === cat)!;
  const isVideo = c.videos.length > 0;

  useEffect(() => {
    if (!open || isVideo || cache[cat]) return;
    let alive = true;
    setLoading(true);
    getPublishedSessions({ data: { category: cat } })
      .then((s) => alive && setCache((m) => ({ ...m, [cat]: s })))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, cat, isVideo, cache]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sessions = cache[cat] ?? [];

  return (
    <>
      <div className="flex justify-center px-5 pb-12 md:pb-16">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="glass hit meta rounded-full px-4 py-2 text-[0.625rem] text-paper transition-opacity hover:opacity-80">
          Explore projects
        </button>
      </div>

      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!open}>
        <div className="absolute inset-0 bg-background/40" onClick={() => setOpen(false)} />
        <div
          ref={panel}
          role="dialog"
          aria-label="Explore projects"
          className={`glass absolute inset-x-3 bottom-3 flex max-h-[60svh] flex-col overflow-hidden rounded-3xl text-paper transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] md:inset-x-auto md:bottom-8 md:left-1/2 md:w-[min(44rem,calc(100vw-4rem))] md:-translate-x-1/2 ${open ? "translate-y-0" : "translate-y-[110%] md:translate-y-[calc(100%+3rem)]"}`}
        >
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <span className="meta text-[0.625rem] text-paper/70">Explore projects</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="hit inline-flex size-6 items-center justify-center rounded-full text-paper/80 hover:text-paper">
              <span aria-hidden className="relative block size-2.5">
                <span className="absolute left-0 top-1/2 h-px w-full rotate-45 bg-current" />
                <span className="absolute left-0 top-1/2 h-px w-full -rotate-45 bg-current" />
              </span>
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
            {internalCategories.map((x) => (
              <button
                key={x.slug}
                type="button"
                onClick={() => setCat(x.slug)}
                className={`meta shrink-0 rounded-full px-3 py-1.5 text-[0.625rem] transition-colors ${x.slug === cat ? "bg-paper/15 text-paper" : "text-paper/55 hover:text-paper"}`}
              >
                {x.title}
              </button>
            ))}
          </div>

          <div key={cat + String(open)} className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-5 pt-1 [scrollbar-width:none]">
            {isVideo
              ? c.videos.map((v, i) => (
                  <Card key={v.id} i={i} title={v.title ?? "Film"} meta="Film" img={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} as={
                    (children) => <Link to="/$category" params={{ category: cat }} onClick={() => setOpen(false)} className="block">{children}</Link>
                  } />
                ))
              : sessions.map((s, i) => (
                  <Card key={s.id} i={i} title={s.title} meta={`${String(s.count).padStart(2, "0")} frames`} img={s.cover.sm} as={
                    (children) => (
                      <button type="button" className="block text-left" onClick={() => { setOpen(false); lb.open(s.images.map((p) => ({ src: p.full, w: p.w, h: p.h, alt: s.title })), 0, s.title); }}>
                        {children}
                      </button>
                    )
                  } />
                ))}
            {!isVideo && !loading && sessions.length === 0 && <p className="meta py-10 text-[0.625rem] text-paper/50">—</p>}
            {!isVideo && loading && sessions.length === 0 && <p className="meta py-10 text-[0.625rem] text-paper/50">…</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ i, title, meta, img, as }: { i: number; title: string; meta: string; img: string; as: (c: React.ReactNode) => React.ReactNode }) {
  return (
    <div className="explore-card w-32 shrink-0 snap-start md:w-40" style={{ animationDelay: `${80 + i * 50}ms` }}>
      {as(
        <>
          <div className="aspect-[4/5] overflow-hidden rounded-xl bg-charcoal">
            <img src={img} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </div>
          <span className="meta mt-2 block truncate text-[0.5625rem] text-paper">{title}</span>
          <span className="meta block text-[0.5625rem] text-paper/50">{meta}</span>
        </>,
      )}
    </div>
  );
}
