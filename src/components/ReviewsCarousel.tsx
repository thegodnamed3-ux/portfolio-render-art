import { useEffect, useRef, useState } from "react";
import type { PublicReview } from "@/lib/reviews.functions";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "·";

function Avatar({ r, size = "size-8" }: { r: PublicReview; size?: string }) {
  return r.avatar_url ? (
    <img src={r.avatar_url} alt="" loading="lazy" decoding="async" draggable={false} className={cn(size, "shrink-0 rounded-full object-cover ring-2 ring-white/80")} />
  ) : (
    <span aria-hidden className={cn(size, "inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-[Inter,sans-serif] text-[0.5625rem] font-medium tracking-[0.04em] text-paper ring-2 ring-white/80")}>
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
      className="glass-card flex h-full min-w-0 snap-start flex-col gap-3 overflow-hidden rounded-[30px] px-5 py-4 text-left transition-[scale] duration-200 active:scale-[0.98]"
    >
      <span className="flex w-full items-center gap-2.5">
        <Avatar r={r} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{r.name}</span>
        {r.rating ? <Stars n={r.rating} /> : null}
      </span>
      <span className="line-clamp-6 whitespace-pre-line text-[0.75rem] leading-snug text-ink/75">{r.body}</span>
    </button>
  );
}

/** Reviews window: 4 × 2 cards per screen on desktop, sideways scrolling for more. */
export function ReviewsCarousel({ reviews, active }: { reviews: PublicReview[]; active: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState<PublicReview | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverflow(el.scrollWidth > el.clientWidth + 4));
    ro.observe(el);
    return () => ro.disconnect();
  }, [reviews.length]);

  useEffect(() => { if (!active) setOpen(null); }, [active]);

  return (
    <div className="glass-window relative mt-6 rounded-[36px] p-3 md:p-4">
      <div
        ref={scroller}
        className="grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col grid-rows-[repeat(2,11.5rem)] gap-3 overflow-x-auto overscroll-x-contain scroll-px-1 px-1 py-1 [scrollbar-width:none] sm:auto-cols-[calc((100%-1rem)/2)] sm:gap-4 lg:auto-cols-[calc((100%-3rem)/4)] lg:grid-rows-[repeat(2,12rem)] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => setOpen(r)} />)}
      </div>


      {open && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[36px] bg-paper/40 p-3 backdrop-blur-sm md:p-6" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <figure className="glass-card flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[32px] p-6">
            <figcaption className="flex items-center gap-3">
              <Avatar r={open} size="size-10" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{open.name}</span>
              {open.rating ? <Stars n={open.rating} /> : null}
              <button type="button" onClick={() => setOpen(null)} aria-label="Close review" className="glass-ink grid size-8 place-items-center rounded-full text-ink/70 hover:text-ink">✕</button>
            </figcaption>
            <blockquote className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{open.body}</blockquote>
          </figure>
        </div>
      )}
    </div>
  );
}
