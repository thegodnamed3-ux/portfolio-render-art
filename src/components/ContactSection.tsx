import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ContactLinks } from "@/components/ContactLinks";
import { getApprovedReviews } from "@/lib/reviews.functions";
import { ReviewsCarousel } from "@/components/ReviewsCarousel";
import { BookingDialog } from "@/components/BookingDialog";
import { useI18n } from "@/lib/i18n";
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
  const [booking, setBooking] = useState(false);
  const { t } = useI18n();
  const reduce = useReducedMotion();
  // "Book a session." and the button slide in from the right, one after another, while their
  // colours invert: the words darken out of the paper, the button turns from paper to ink.
  const ease = [0.16, 0.8, 0.1, 1] as const;
  const PAPER = "#f1efea";
  const INK = "#1b1b1b";
  const step = (extra: object = {}) => ({
    variants: { hidden: { opacity: 0, x: 80, color: PAPER, ...extra }, shown: { opacity: 1, x: 0, color: INK } },
    transition: reduce ? { duration: 0 } : { duration: 1.2, ease },
  });
  const has = withReviews && reviews.length > 0;
  const onReviews = has && view === "reviews";

  // One height for both panes, on every screen: switching never resizes or scrolls the page.
  const paneA = useRef<HTMLDivElement>(null);
  const paneB = useRef<HTMLDivElement>(null);
  const panes = [paneA, paneB] as const;
  const [heights, setHeights] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const measure = () =>
      setHeights([paneA.current?.offsetHeight ?? 0, paneB.current?.offsetHeight ?? 0]);
    measure();
    const ro = new ResizeObserver(measure);
    if (paneA.current) ro.observe(paneA.current);
    if (paneB.current) ro.observe(paneB.current);
    return () => ro.disconnect();
  }, [has]);
  const height = Math.max(heights[0], heights[1]);

  const section = useRef<HTMLElement>(null);
  const toggle = () => setView(onReviews ? "contact" : "reviews");

  return (
    <section ref={section} {...(id ? { id } : {})} data-nav-light className="bg-paper px-5 pb-10 pt-14 text-ink md:px-10 md:pt-20">
      <div className="flex items-center justify-between gap-4">
        <h2 className="display text-3xl leading-none md:text-4xl">{onReviews ? t("reviews.title") : t("contact.title")}</h2>
        {has && (
          <motion.button
            type="button"
            onClick={toggle}
            aria-expanded={onReviews}
            // Blinks once with a black outline when the band comes into view, to hint at the reviews.
            style={{ outline: "1.5px solid transparent", outlineOffset: 3 }}
            whileInView={reduce ? {} : { outlineColor: ["rgba(27,27,27,0)", "rgba(27,27,27,1)", "rgba(27,27,27,0)"] }}
            viewport={{ once: true, amount: 1 }}
            transition={{ duration: 1.1, delay: 1.3, ease: "easeInOut", times: [0, 0.35, 1] }}
            className="glass-ink hit group meta inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.625rem] text-ink"
          >
            {onReviews ? (
              <><span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>{t("contact.pill")}</>
            ) : (
              <>{t("reviews.pill")}<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span></>
            )}
          </motion.button>
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
          <div aria-hidden={onReviews} className={cn("flex w-1/2 shrink-0 flex-col justify-center pr-8 transition-[visibility] duration-700", onReviews && "invisible")}>
            <motion.div
              ref={panes[0]}
              className="py-8 md:py-10"
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, amount: 0.3 }}
              variants={{ hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : 0.14 } } }}
            >
            <p className="display text-[15vw] leading-[0.95] md:text-[9vw]">
              <motion.span className="inline-block" {...step()}>{t("book.l1")}</motion.span>{" "}
              <motion.em className="inline-block" {...step()}>{t("book.l2")}</motion.em>
            </p>
            {/* Movement lives on a wrapper: the button's own opacity stays free for its CSS hover/press
                transitions — sharing it with the animation made the button flicker. */}
            <motion.div
              className="mt-8 w-fit md:mt-12"
              variants={{ hidden: { opacity: 0, x: 80 }, shown: { opacity: 1, x: 0 } }}
              transition={reduce ? { duration: 0 } : { duration: 1.2, ease }}
            >
            <motion.button
              type="button"
              onClick={() => setBooking(true)}
              tabIndex={onReviews ? -1 : 0}
              variants={{
                hidden: { backgroundColor: PAPER, color: INK },
                shown: { backgroundColor: INK, color: PAPER },
              }}
              transition={reduce ? { duration: 0 } : { duration: 1.2, ease }}
              className="hit group meta inline-flex items-center gap-2.5 rounded-full border border-ink px-4 py-2.5 text-[0.625rem] transition-[opacity,scale] duration-150 hover:opacity-85 active:scale-[0.96] md:mt-12"
            >
              {t("book.send")}
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </motion.button>
            </motion.div>
            <ContactLinks tone="light" className="mt-3" />
            </motion.div>
          </div>
          <div aria-hidden={!onReviews} className={cn("flex w-1/2 shrink-0 flex-col justify-center transition-[visibility] duration-700", !onReviews && "invisible")}>
            {/* Both panes are centred in the same height, so they share one centre line. */}
            <div ref={panes[1]} className="py-8 md:py-10">
            {has && (
              <div data-reviews-window>
                <ReviewsCarousel reviews={reviews} active={onReviews} />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {booking && <BookingDialog onClose={() => setBooking(false)} />}

      <footer className="meta mt-12 border-t border-ink/15 pt-5 text-ink-muted">
        <div className="flex items-baseline justify-between gap-4">
          <Link to="/" hash="top" className="wordmark text-ink transition-opacity hover:opacity-60">thegodnamed</Link>
          <span className="flex items-baseline gap-2.5 whitespace-nowrap font-[Inter,sans-serif] text-[0.6875rem] font-medium uppercase leading-none tracking-[0.06em] text-ink-muted/65 md:text-xs">
            <Link to="/privacy" className="transition-colors hover:text-ink">{t("footer.privacy")}</Link>
            <span>{t("footer.city")}</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </span>
        </div>
      </footer>
    </section>
  );
}
