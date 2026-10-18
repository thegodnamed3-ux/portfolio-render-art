import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useFadeIn } from "@/components/Frame";
import type { GalleryPhoto } from "@/content/types";
import { cn } from "@/lib/utils";

const ease = [0.2, 0.8, 0.2, 1] as const;

export const CollapseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6M10 14l-6.5 6.5M20 10h-6V4M14 10l6.5-6.5" />
  </svg>
);

/** Full-screen glass page: blurred photo behind, sticky glass header, content below. */
export function GlassPage({ cover, header, children }: { cover: string | null; header: ReactNode; children: ReactNode }) {
  return (
    <main className="relative min-h-[100svh] bg-background text-paper">
      {cover && <img src={cover} alt="" aria-hidden className="fixed inset-0 h-full w-full scale-110 object-cover opacity-60 blur-3xl" />}
      <div className="glass-panel relative min-h-[100svh] !rounded-none !border-0">
        <header className="sticky top-0 z-20 border-b border-paper/10 bg-charcoal/85 backdrop-blur-2xl [-webkit-backdrop-filter:blur(40px)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {header}
        </header>
        {children}
      </div>
    </main>
  );
}

function useImg(ph: { sm: string; src: string }, sizes: string, eager: boolean, zoom = true) {
  const fade = useFadeIn();
  return (
    <img
      ref={fade.ref}
      onLoad={fade.onLoad}
      onError={fade.onError}
      data-fade=""
      src={ph.sm}
      srcSet={`${ph.sm} 600w, ${ph.src} 1240w`}
      sizes={sizes}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "h-full w-full object-cover [transition:opacity_500ms_ease-out,transform_900ms_cubic-bezier(0.2,0.7,0.1,1)]",
        zoom && "group-hover:scale-[1.04]",
        fade.loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/** One photo in a masonry column; opens the viewer from where it sits. */
export function PhotoTile({ ph, i, label, onOpen }: { ph: Omit<GalleryPhoto, "project">; i: number; label: string; onOpen: (el: Element) => void }) {
  const reduce = useReducedMotion();
  const img = useImg(ph, "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw", i < 8);
  return (
    <motion.button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${label} ${i + 1}`}
      className="group mb-2 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-[12px] bg-charcoal md:mb-3"
      style={{ aspectRatio: `${ph.w} / ${ph.h}` }}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.04, ease }}
    >
      {img}
    </motion.button>
  );
}

/** A shoot, folded: its cover, title and frame count. */
export function ShootCard({ cover, title, meta, i, children }: { cover: { sm: string; src: string }; title: string; meta: string; i: number; children: (inner: ReactNode) => ReactNode }) {
  const reduce = useReducedMotion();
  const img = useImg(cover, "(min-width: 1280px) 16vw, (min-width: 768px) 20vw, 33vw", i < 9);
  const inner = (
    <>
      <span className="block aspect-[4/5] overflow-hidden rounded-[10px] bg-charcoal md:rounded-[12px]">{img}</span>
      <span className="mt-2 block truncate text-[0.6875rem] leading-tight text-paper md:mt-3 md:text-sm">{title}</span>
      <span className="meta mt-0.5 block text-[0.5625rem] text-paper/45 md:text-[0.625rem]">{meta}</span>
    </>
  );
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(i, 15) * 0.03, ease }}
      className="group min-w-0"
    >
      {children(inner)}
    </motion.li>
  );
}
