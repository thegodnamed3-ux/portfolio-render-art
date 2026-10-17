import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicReview } from "@/lib/reviews.functions";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "·";

function Avatar({ r, size = "size-8" }: { r: PublicReview; size?: string }) {
  return r.avatar_url ? (
    <img src={r.avatar_url} alt="" loading="lazy" decoding="async" draggable={false} className={cn(size, "shrink-0 rounded-full object-cover")} />
  ) : (
    <span aria-hidden className={cn(size, "inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-[Inter,sans-serif] text-[0.5625rem] font-medium tracking-[0.04em] text-paper")}>
      {initials(r.name)}
    </span>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5`} className="text-[0.625rem] tracking-[0.1em] text-ink">
      {"★".repeat(n)}<span className="text-ink/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function ReviewCard({ r, onOpen }: { r: PublicReview; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card flex h-full min-w-0 snap-start flex-col gap-2 overflow-hidden rounded-[22px] px-4 py-3 text-left transition-[scale] duration-200 active:scale-[0.98]"
    >
      <span className="flex w-full items-center gap-2">
        <Avatar r={r} size="size-6" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{r.name}</span>
        {r.rating ? <Stars n={r.rating} /> : null}
      </span>
      <span className="line-clamp-4 text-[0.6875rem] leading-snug text-ink/75 lg:line-clamp-4">{r.body}</span>
    </button>
  );
}

/** Reviews window: 4 × 2 cards per screen on desktop, sideways scrolling for more. */
export function ReviewsCarousel({ reviews, active }: { reviews: PublicReview[]; active: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState<PublicReview | null>(null);
  // Progress bar fills left to right: the share of reviews already scrolled into view.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setOverflow(max > 4);
      setProgress(el.scrollWidth ? Math.min(1, (el.scrollLeft + el.clientWidth) / el.scrollWidth) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, [reviews.length]);

  // The full review opens above everything; Escape or a tap outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { html.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => { if (!active) setOpen(null); }, [active]);

  return (
    <div className="glass-window relative mt-10 flex flex-1 flex-col rounded-[28px] p-2.5 md:p-3 lg:mt-12">
      <div
        ref={scroller}
        className="grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col min-h-0 flex-1 grid-rows-[minmax(8.25rem,1fr)] gap-2.5 overflow-x-auto overscroll-x-contain scroll-px-1 px-1 py-1 [scrollbar-width:none] sm:auto-cols-[calc((100%-0.75rem)/2)] sm:gap-3 lg:auto-cols-[calc((100%-2.25rem)/4)] lg:grid-rows-[repeat(2,minmax(7.25rem,1fr))] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => setOpen(r)} />)}
      </div>

      {overflow && (
        <div className="mt-2.5 px-2 pb-1 md:mt-3" aria-hidden>
          <div className="relative h-1 overflow-hidden rounded-full bg-ink/10">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ink/55 transition-[width] duration-200 ease-out" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      {open && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Review by ${open.name}`}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-white/5 p-4 backdrop-blur-2xl"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
        >
          <figure className="glass-card flex max-h-[85svh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[32px] !bg-white/85 p-6 md:p-8">
            <figcaption className="flex items-center gap-3">
              <Avatar r={open} size="size-11" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{open.name}</span>
              {open.rating ? <Stars n={open.rating} /> : null}
              <button type="button" onClick={() => setOpen(null)} aria-label="Close review" className="glass-ink hit grid size-9 shrink-0 place-items-center self-center rounded-full text-ink/70 hover:text-ink">
                <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </figcaption>
            <blockquote className="whitespace-pre-line text-sm leading-relaxed text-ink/80 md:text-base">{open.body}</blockquote>
          </figure>
        </div>,
        document.body,
      )}
    </div>
  );
}
