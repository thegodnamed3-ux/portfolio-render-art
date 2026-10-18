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
        <div>
          <p className="meta mb-2 text-ink/45">04 —</p>
          <h2 className="display text-3xl leading-none md:text-4xl">{onReviews ? t("reviews.title") : t("contact.title")}</h2>
        </div>
        {has && (
          <motion.button
            type="button"
            onClick={toggle}
            aria-expanded={onReviews}
            // A plain word: when the band comes into view its underline sweeps through once, hinting at the reviews.
            whileInView={reduce ? {} : { backgroundSize: ["0% 1px", "100% 1px", "100% 1px", "0% 1px"] }}
            viewport={{ once: true, amount: 1 }}
            transition={{ duration: 1.6, delay: 1.3, ease: "easeInOut", times: [0, 0.4, 0.7, 1] }}
            className="link-u hit group meta inline-flex items-center gap-2 self-end py-1 text-[0.6875rem] text-ink"
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
            {/* A typographic link, always underlined, instead of a pill button. Nudged in so its first
                letter lines up optically with the big serif "B" above (serif capitals carry a side bearing). */}
            <div className="mt-8 w-fit pl-[0.15vw] md:mt-12 md:pl-[0.12vw]">
            <motion.button
              type="button"
              onClick={() => setBooking(true)}
              tabIndex={onReviews ? -1 : 0}
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
              transition={reduce ? { duration: 0 } : { duration: 1.2, ease }}
              className="link-u link-on hit group meta inline-flex items-center gap-2.5 py-1 text-[0.75rem] text-ink"
            >
              {t("book.send")}
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </motion.button>
            </div>
            {/* Messengers sit on the right edge of the band, opposite the request link. */}
            {/* Instagram / Behance reach the band's right edge (past the pane's inner padding). */}
            <ContactLinks tone="light" align="end" className="mt-6 md:-mt-10" iconsClassName="-mr-8" />
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

      <footer className="meta mt-12 border-t border-ink/15 pt-6 text-ink-muted md:pt-10">
        {/* The closing line of the page: the wordmark set edge to edge, like a magazine's last spread. */}
        <Link to="/" hash="top" aria-label="thegodnamed" className="block text-ink transition-opacity hover:opacity-70">
          <svg viewBox="0 0 1000 150" aria-hidden className="block h-auto w-full overflow-visible">
            <text x="0" y="122" textLength="1000" lengthAdjust="spacingAndGlyphs" className="wordmark" style={{ fontSize: 168, fill: "currentColor" }}>thegodnamed</text>
          </svg>
        </Link>
        <div className="mt-4 flex items-baseline justify-end gap-4 md:mt-6">
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
