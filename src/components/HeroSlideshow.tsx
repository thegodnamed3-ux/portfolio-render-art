import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HomeImage } from "@/lib/portfolio.functions";
import { cn } from "@/lib/utils";

const INTERVAL = 5500;

/** Full-bleed crossfading background slides with discreet glass arrows. */
export function HeroSlideshow({ slides, controlsClassName }: { slides: HomeImage[]; controlsClassName?: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const reduced = useRef(false);
  const n = slides.length;

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (n < 2 || paused || reduced.current) return;
    const t = setTimeout(() => setI((v) => (v + 1) % n), INTERVAL);
    return () => clearTimeout(t);
  }, [i, n, paused, tick]);

  const go = useCallback((d: number) => { setI((v) => (v + d + n) % n); setTick((t) => t + 1); }, [n]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden>
        {slides.map((s, k) => {
          const near = k === i || k === (i + 1) % n;
          return (
            <img
              key={s.src + k}
              src={near || k === 0 ? s.src : undefined}
              data-src={s.src}
              alt=""
              loading={k === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{ objectPosition: s.pos ?? "50% 50%" }}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out motion-reduce:transition-none",
                k === i ? "opacity-100" : "opacity-0",
              )}
            />
          );
        })}
      </div>
      {n > 1 && (
        <div
          className={cn("flex gap-2", controlsClassName)}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => go(d)}
              aria-label={d < 0 ? "Previous photograph" : "Next photograph"}
              className="glass hit grid size-8 place-items-center rounded-full text-paper/85 transition-colors hover:text-paper"
            >
              {d < 0 ? <ChevronLeft className="size-3.5" strokeWidth={1.5} /> : <ChevronRight className="size-3.5" strokeWidth={1.5} />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
