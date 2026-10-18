import { useEffect, useState } from "react";
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
      {force !== "desktop" && <Strip items={items} className={force ? "flex" : "flex md:hidden"} />}
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

  // Warm the next frame so arrows never wait on the network.
  useEffect(() => {
    const next = items[(i + 1) % n];
    if (next) { const img = new Image(); img.src = next.src; }
  }, [i, n, items]);

  return (
    <div className={cn(className, "grid-cols-[minmax(0,1fr)_15rem] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12")}>
      <div className="relative h-[min(76vh,50vw)] min-h-[22rem]">
        <AnimatePresence initial={false}>
          <motion.img
            key={cur.src + i}
            src={cur.src}
            alt={cur.caption ?? "Photograph"}
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

      <div className="flex min-h-0 flex-col justify-between gap-6">
        <div>
          <p className="display text-2xl italic leading-none tabular-nums text-paper">{pad(i + 1)}<span className="text-paper/40"> / {pad(n)}</span></p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={i}
              className="display mt-4 text-3xl leading-[1.05] text-paper lg:text-4xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.35, ease }}
            >
              {cur.caption || " "}
            </motion.p>
          </AnimatePresence>
        </div>

        {n > 1 && (
          <div className="grid max-h-[min(44vh,30vw)] grid-cols-3 content-start gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {items.map((it, k) => (
              <button
                key={it.src + k}
                type="button"
                onClick={() => setI(k)}
                aria-label={`${t("sp.show")} ${k + 1}`}
                aria-current={k === i}
                className={cn("aspect-square overflow-hidden bg-charcoal transition-opacity duration-300", k === i ? "opacity-100 outline outline-1 outline-offset-2 outline-paper/70" : "opacity-40 hover:opacity-80")}
              >
                <img src={it.sm ?? it.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {n > 1 && (
          <div className="meta flex items-center gap-6 text-paper/70">
            <button type="button" onClick={() => go(-1)} aria-label={t("sp.prev")} className="hit flex w-10 items-center py-3 transition-colors hover:text-paper"><LongArrow left /></button>
            <span className="h-px flex-1 bg-paper/15" aria-hidden>
              <span className="block h-px bg-paper/70 transition-[width] duration-500" style={{ width: `${((i + 1) / n) * 100}%` }} />
            </span>
            <button type="button" onClick={() => go(1)} aria-label={t("sp.next")} className="hit flex w-10 items-center py-3 transition-colors hover:text-paper"><LongArrow left={false} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function Strip({ items, className }: { items: WorkItem[]; className: string }) {
  return (
    <div className={cn(className, "-mx-5 snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
      {items.map((it, k) => <StripFrame key={it.src + k} it={it} k={k} n={items.length} />)}
    </div>
  );
}

function StripFrame({ it, k, n }: { it: WorkItem; k: number; n: number }) {
  const fade = useFadeIn();
  return (
    <figure className="shrink-0 snap-center">
      <div className="h-[58svh] max-w-[86vw] overflow-hidden bg-charcoal" style={{ aspectRatio: `${it.w} / ${it.h}` }}>
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
