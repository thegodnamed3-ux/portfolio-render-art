import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorkItem } from "@/content/home";
import { useFadeIn } from "@/components/Frame";
import { LongArrow } from "@/components/LongArrow";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ease = [0.2, 0.8, 0.2, 1] as const;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Top of "Selected works". Desktop: one large photo with its caption, counter, thin arrows and a
 * column of thumbnails. Phones: a simple sideways strip of the same photos.
 * `force` pins one layout for the studio preview.
 */
export function Spotlight({ items, force }: { items: WorkItem[]; force?: "desktop" | "mobile" }) {
  if (!items.length) return null;
  return (
    <>
      {force !== "mobile" && <Desk items={items} className={force ? "grid" : "hidden md:grid"} />}
      {force !== "desktop" && <Strip items={items} className={force ? "flex" : "flex md:hidden"} boxed={force === "mobile"} />}
    </>
  );
}

function Desk({ items, className }: { items: WorkItem[]; className: string }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const n = items.length;
  const cur = items[i % n]!;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  // Warm the next frame so arrows never wait — but only after the visitor starts browsing,
  // so the first page load isn't spent on photos further down.
  useEffect(() => {
    if (i === 0) return;
    const next = items[(i + 1) % n];
    if (next) { const img = new Image(); img.src = next.src; }
  }, [i, n, items]);

  // Keep the active thumbnail in view in the film strip.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll only the strip itself (scrollIntoView would also scroll the page on load).
    const box = strip.current;
    const el = box?.children[i] as HTMLElement | undefined;
    if (box && el) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [i, reduce]);

  /* Desktop: the photo large and centred; under it one calm row — counter and arrows on the left,
     the caption, and a film strip of thumbnails that scrolls sideways. (The old side column
     squeezed 30 thumbnails into a narrow box at the edge, where they overlapped.) */
  return (
    <div className={cn(className, "grid-cols-1 gap-6")}>
      <div className="relative h-[min(74vh,52vw)] min-h-[22rem]">
        <AnimatePresence initial={false}>
          <motion.img
            key={cur.src + i}
            src={cur.src}
            alt={cur.caption ?? "Photograph"}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ objectPosition: cur.pos ?? "50% 50%" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.7, ease }}
            draggable={false}
          />
        </AnimatePresence>
        {/* Halves of the photo double as previous / next. */}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("sp.prev")} className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" />
            <button type="button" onClick={() => go(1)} aria-label={t("sp.next")} className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" />
          </>
        )}
      </div>

      {n > 1 && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-10 gap-y-4 border-t border-paper/10 pt-5 lg:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)]">
          <div className="flex items-center gap-5 text-paper/70">
            <button type="button" onClick={() => go(-1)} aria-label={t("sp.prev")} className="hit flex w-10 items-center py-2 transition-colors hover:text-paper"><LongArrow left /></button>
            <p className="display min-w-[5.5rem] text-center text-2xl italic leading-none tabular-nums text-paper">{pad(i + 1)}<span className="text-paper/40"> / {pad(n)}</span></p>
            <button type="button" onClick={() => go(1)} aria-label={t("sp.next")} className="hit flex w-10 items-center py-2 transition-colors hover:text-paper"><LongArrow left={false} /></button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={i}
              className="display truncate text-xl leading-tight text-paper/85"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.3, ease }}
            >
              {cur.caption || "\u00a0"}
            </motion.p>
          </AnimatePresence>
          <div ref={strip} className="relative col-span-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:col-span-1 [&::-webkit-scrollbar]:hidden">
            {items.map((it, k) => (
              <button
                key={it.src + k}
                type="button"
                onClick={() => setI(k)}
                aria-label={`${t("sp.show")} ${k + 1}`}
                aria-current={k === i}
                className={cn("h-14 w-14 shrink-0 overflow-hidden bg-charcoal transition-opacity duration-300", k === i ? "opacity-100 ring-1 ring-paper/80 ring-offset-2 ring-offset-background" : "opacity-40 hover:opacity-80")}
              >
                <img src={it.sm ?? it.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** `boxed`: the studio's phone preview — sizes come from the 375px preview box, not from the
 *  (desktop) screen, which made the frames huge and the strip look broken there. */
function Strip({ items, className, boxed = false }: { items: WorkItem[]; className: string; boxed?: boolean }) {
  return (
    <div className={cn(className, boxed ? "snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "-mx-5 snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
      {items.map((it, k) => <StripFrame key={it.src + k} it={it} k={k} n={items.length} boxed={boxed} />)}
    </div>
  );
}

function StripFrame({ it, k, n, boxed = false }: { it: WorkItem; k: number; n: number; boxed?: boolean }) {
  const fade = useFadeIn();
  return (
    <figure className="shrink-0 snap-center">
      <div className={cn("overflow-hidden bg-charcoal", boxed ? "h-[400px] max-w-[290px]" : "h-[58svh] max-w-[86vw]")} style={{ aspectRatio: `${it.w} / ${it.h}` }}>
        <img
          ref={fade.ref}
          onLoad={fade.onLoad}
          onError={fade.onError}
          data-fade=""
          src={it.src}
          srcSet={it.sm ? `${it.sm} 600w, ${it.src} 1240w` : undefined}
          sizes="86vw"
          alt={it.caption ?? "Photograph"}
          loading={k < 2 ? "eager" : "lazy"}
          decoding="async"
          className={cn("h-full w-full object-cover transition-opacity duration-500", fade.loaded ? "opacity-100" : "opacity-0")}
          style={it.pos ? { objectPosition: it.pos } : undefined}
        />
      </div>
      <figcaption className="meta mt-3 flex justify-between gap-4 text-muted-foreground">
        <span className="truncate">{it.caption}</span>
        <span>{pad(k + 1)} / {pad(n)}</span>
      </figcaption>
    </figure>
  );
}
