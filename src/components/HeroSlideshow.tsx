import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomeImage } from "@/lib/portfolio.functions";
import { cn } from "@/lib/utils";
import { LongArrow } from "@/components/LongArrow";

const INTERVAL = 5500;

/** Full-bleed crossfading background slides with discreet glass arrows. */
export function HeroSlideshow({ slides, controlsClassName, controlsContainer }: { slides: HomeImage[]; controlsClassName?: string; controlsContainer?: HTMLElement | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  /** Arrow clicks answer quickly; the automatic crossfade stays slow. */
  const [manual, setManual] = useState(false);
  const reduced = useRef(false);
  const n = slides.length;
  // First visit: only the first frame downloads. The next one starts once the page has finished
  // loading, so it never competes with the first picture people actually see.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const go = () => setTimeout(() => setWarm(true), 400);
    if (document.readyState === "complete") { go(); return; }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (n < 2 || paused || reduced.current) return;
    const t = setTimeout(() => { setManual(false); setI((v) => (v + 1) % n); }, INTERVAL);
    return () => clearTimeout(t);
  }, [i, n, paused, tick]);

  const go = useCallback((d: number) => { setManual(true); setI((v) => (v + d + n) % n); setTick((t) => t + 1); }, [n]);

  // Swipe left/right anywhere on the hero to change the photo (vertical moves still scroll the page).
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = layer.current?.parentElement;
    if (!host || n < 2) return;
    let x0 = 0, y0 = 0, on = false;
    const start = (e: TouchEvent) => { if (e.touches.length !== 1) { on = false; return; } on = true; x0 = e.touches[0]!.clientX; y0 = e.touches[0]!.clientY; };
    const end = (e: TouchEvent) => {
      if (!on) return; on = false;
      const t = e.changedTouches[0]; if (!t) return;
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
    };
    host.addEventListener("touchstart", start, { passive: true });
    host.addEventListener("touchend", end, { passive: true });
    return () => { host.removeEventListener("touchstart", start); host.removeEventListener("touchend", end); };
  }, [go, n]);

  // Arrows go into the page's own slot when one is given (portal), else sit where styled.
  const wrap = (node: React.ReactNode) => (controlsContainer ? createPortal(node, controlsContainer) : node);

  return (
    <>
      <div ref={layer} className="absolute inset-0" aria-hidden>
        {slides.map((s, k) => {
          const near = k === i || (warm && k === (i + 1) % n);
          return (
            <img
              key={s.src + k}
              src={near || k === 0 ? s.src : undefined}
              data-src={s.src}
              alt=""
              loading={k === 0 ? "eager" : "lazy"}
              {...(k === 0 ? { fetchPriority: "high" as const } : {})}
              decoding={k === 0 ? "sync" : "async"}
              style={{ objectPosition: s.pos ?? "50% 50%", transitionDuration: manual ? "550ms" : undefined }}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out motion-reduce:transition-none",
                k === i ? "opacity-100" : "opacity-0",
              )}
            />
          );
        })}
      </div>
      {n > 1 && (controlsContainer || controlsClassName) && wrap(
        // Frameless: two drawn arrows side by side on one soft rectangular shade; the left one starts
        // where the "Scroll ↓" label below starts (the page sets the container's width).
        <div
          className={cn("relative flex w-full items-center gap-5", controlsClassName)}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-2 -z-10 rounded-md bg-black/35 blur-md" />
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => go(d)}
              aria-label={d < 0 ? "Previous photograph" : "Next photograph"}
              // Each arrow takes half the width (long shaft, small head) and a tall tap area.
              className="hit flex flex-1 cursor-pointer items-center py-3 text-paper/80 transition-colors hover:text-paper"
            >
              <LongArrow left={d < 0} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

