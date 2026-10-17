import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ContactLinks } from "@/components/ContactLinks";
import { getApprovedReviews } from "@/lib/reviews.functions";
import { ReviewsCarousel } from "@/components/ReviewsCarousel";
import { cn } from "@/lib/utils";

/**
 * The paper "Contact" band from the homepage. With approved reviews it gains a small
 * "Reviews →" pill that slides the band sideways to a glass window of review cards.
 */
export function ContactSection({ id, reviews: withReviews = true }: { id?: string; reviews?: boolean }) {
  const fetchReviews = useServerFn(getApprovedReviews);
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", "approved"],
    queryFn: () => fetchReviews(),
    staleTime: 300_000,
    enabled: withReviews,
  });
  const [view, setView] = useState<"contact" | "reviews">("contact");
  const has = withReviews && reviews.length > 0;
  const onReviews = has && view === "reviews";

  // Desktop: the band keeps one height (the taller pane's) so switching never resizes the page.
  // Phones: it takes the height of the pane on show, so the contacts don't float in empty space.
  const panes = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const [heights, setHeights] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const ro = new ResizeObserver(() => setHeights([panes[0].current?.offsetHeight ?? 0, panes[1].current?.offsetHeight ?? 0]));
    panes.forEach((p) => p.current && ro.observe(p.current));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has]);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const height = wide ? Math.max(heights[0], heights[1]) : heights[onReviews ? 1 : 0];

  // Switching panes brings the whole band into view, so the reviews window is never cut off.
  const section = useRef<HTMLElement>(null);
  const toggle = () => {
    const opening = !onReviews;
    setView(opening ? "reviews" : "contact");
    const el = section.current;
    if (!el) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (!opening) return;
    // Once the reviews have slid in, make sure the whole window is on screen.
    setTimeout(() => {
      const win = el.querySelector<HTMLElement>("[data-reviews-window]");
      if (!win) return;
      const overshoot = win.getBoundingClientRect().bottom + 24 - window.innerHeight;
      if (overshoot > 0) window.scrollBy({ top: overshoot, behavior });
    }, 760);
  };

  return (
    <section ref={section} {...(id ? { id } : {})} data-nav-light className="bg-paper px-5 pb-10 pt-14 text-ink md:px-10 md:pt-20">
      <div className="flex items-center justify-between gap-4">
        <h2 className="display text-3xl leading-none md:text-4xl">{onReviews ? "Reviews." : "Contact."}</h2>
        {has && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={onReviews}
            className="glass-ink hit group meta inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.625rem] text-ink"
          >
            {onReviews ? (
              <><span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>Contact</>
            ) : (
              <>Reviews<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span></>
            )}
          </button>
        )}
      </div>

      <div
        className="-mx-2 overflow-hidden px-2 pb-2"
        style={has && height ? { height: height + 8 } : undefined}
      >
        <div
          className="flex w-[200%] items-stretch transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
          style={{ transform: onReviews ? "translateX(-50%)" : "translateX(0)" }}
        >
          <div aria-hidden={onReviews} className={cn("flex w-1/2 shrink-0 flex-col justify-start pr-8 md:justify-center transition-[visibility] duration-700", onReviews && "invisible")}>
            <div ref={panes[0]} className="pb-2 pt-10 md:pt-12">
            <p className="display text-[15vw] leading-[0.95] md:text-[9vw]">
              Book a <em>session.</em>
            </p>
            <ContactLinks tone="light" className="mt-8 md:mt-12" />
            </div>
          </div>
          <div aria-hidden={!onReviews} className={cn("w-1/2 shrink-0 transition-[visibility] duration-700", !onReviews && "invisible")}>
            <div ref={panes[1]}>
            {has && (
              <div data-reviews-window>
                <ReviewsCarousel reviews={reviews} active={onReviews} />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <footer className="meta mt-12 border-t border-ink/15 pt-5 text-ink-muted md:mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <Link to="/" hash="top" className="wordmark text-ink transition-opacity hover:opacity-60">thegodnamed</Link>
          <span className="flex items-baseline gap-2.5 whitespace-nowrap font-[Inter,sans-serif] text-[0.6875rem] font-medium uppercase leading-none tracking-[0.06em] text-ink-muted/65 md:text-xs">
            <span>Tallinn</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </span>
        </div>
      </footer>
    </section>
  );
}
