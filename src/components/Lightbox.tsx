import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { ContactLinks } from "./ContactLinks";

export type ViewerItem = { src: string; w: number; h: number; alt?: string };

type Ctx = { open: (items: ViewerItem[], index: number, title?: string) => void };
const LightboxContext = createContext<Ctx>({ open: () => {} });
export const useLightbox = () => useContext(LightboxContext);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ items: ViewerItem[]; index: number; title?: string | undefined } | null>(null);
  const open = useCallback((items: ViewerItem[], index: number, title?: string) => setState({ items, index, title }), []);
  const close = useCallback(() => setState(null), []);
  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>{state && <Viewer key="viewer" {...state} onClose={close} />}</AnimatePresence>
    </LightboxContext.Provider>
  );
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 stroke-current" strokeWidth="1.5" fill="none"><path d="M5 5l14 14M19 5 5 19" /></svg>
);

/** Stack geometry: depth offsets are pure translation — never rotation. */
const OFFSET = 7;
const DEPTH = 3;
const THRESHOLD = 90;
const spring = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 } as const;

function useViewport() {
  const [vp, setVp] = useState({ w: 1024, h: 768 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

function Viewer({ items, index: start, title, onClose }: { items: ViewerItem[]; index: number; title?: string | undefined; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [dir, setDir] = useState<1 | -1>(1);
  const [panel, setPanel] = useState(false);
  const [bump, setBump] = useState(0);
  const exitY = useRef(0);
  const reduce = useReducedMotion();
  const vp = useViewport();
  const n = items.length;
  const atEnd = index === n - 1;

  const go = useCallback((d: 1 | -1, y = 0) => {
    exitY.current = y;
    setIndex((i) => {
      const next = i + d;
      if (next < 0 || next >= n) { setBump((b) => b + 1); return i; }
      setDir(d);
      return next;
    });
  }, [n]);

  // Lock background scroll; the page stays mounted underneath, so its scroll position is kept.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => { html.style.overflow = prev[0]!; document.body.style.overflow = prev[1]!; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (panel) setPanel(false); else onClose(); }
      else if (!panel && e.key === "ArrowRight") go(1);
      else if (!panel && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, panel]);

  // Preload the next two photographs only.
  useEffect(() => {
    [1, 2].forEach((d) => { const it = items[index + d]; if (it) { const img = new Image(); img.src = it.src; } });
  }, [index, items]);

  // Fit every card into the same stage, preserving its native aspect ratio.
  const mobile = vp.w < 768;
  const stageW = vp.w * (mobile ? 0.88 : 0.72) - OFFSET * DEPTH;
  const stageH = vp.h * (mobile ? 0.66 : 0.74) - OFFSET * DEPTH;
  const size = (it: ViewerItem) => {
    const s = Math.min(stageW / it.w, stageH / it.h);
    return { w: Math.round(it.w * s), h: Math.round(it.h * s) };
  };

  const visible = items.slice(index, index + DEPTH + 1);
  const t = reduce ? { duration: 0.15 } : spring;
  const exitX = vp.w * 0.9;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} — photo viewer` : "Photo viewer"}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-viewer/85 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.1 : 0.3 }}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <span className="glass meta rounded-full px-4 py-2 text-paper/80">
          {title && <span className="mr-3 text-paper">{title}</span>}
          {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <button onClick={onClose} aria-label="Close viewer" className="glass inline-flex size-10 items-center justify-center rounded-full text-paper/80 transition-colors hover:text-paper"><CloseIcon /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div
          key={bump}
          className="relative"
          style={{ width: stageW + OFFSET * DEPTH, height: stageH + OFFSET * DEPTH }}
          animate={bump && !reduce ? { x: [0, -6, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
        >
          <AnimatePresence initial={false} custom={{ dir, y: exitY.current }}>
            {visible.map((it, d) => (
              <Card
                key={index + d}
                item={it}
                size={size(it)}
                depth={d}
                stage={{ w: stageW, h: stageH }}
                dir={dir}
                exitX={exitX}
                transition={t}
                onNext={(y) => go(1, y)}
                onPrev={(y) => go(-1, y)}
                canNext={index + d < n - 1}
              />
            )).reverse()}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <div className="glass flex items-center rounded-full">
          <button onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo" className="meta px-4 py-2.5 text-paper/80 transition-colors hover:text-paper disabled:opacity-30">←</button>
          <span className="h-4 w-px bg-paper/15" />
          <button onClick={() => go(1)} disabled={atEnd} aria-label="Next photo" className="meta px-4 py-2.5 text-paper/80 transition-colors hover:text-paper disabled:opacity-30">→</button>
        </div>
        <AnimatePresence>
          {atEnd && n > 1 && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="meta absolute left-1/2 -translate-x-1/2 text-paper/50">End of session</motion.span>
          )}
        </AnimatePresence>
        <button onClick={() => setPanel((p) => !p)} aria-expanded={panel} className="glass meta rounded-full px-5 py-2.5 text-paper transition-colors hover:bg-paper hover:text-ink">Book</button>
      </div>

      <AnimatePresence>
        {panel && (
          <motion.div
            className="absolute inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setPanel(false); }}
          >
            <motion.div
              role="dialog"
              aria-label="Book a session"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="glass absolute right-4 rounded-[22px] p-3 md:right-8"
              style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
            >
              <ContactLinks tone="glass" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type CardProps = {
  item: ViewerItem;
  size: { w: number; h: number };
  depth: number;
  stage: { w: number; h: number };
  dir: 1 | -1;
  exitX: number;
  transition: object;
  onNext: (y: number) => void;
  onPrev: (y: number) => void;
  canNext: boolean;
};

function Card({ item, size, depth, stage, dir, exitX, transition, onNext, onPrev, canNext }: CardProps) {
  const top = depth === 0;
  // Free 2D drag; horizontal travel and velocity decide navigation. Motion values avoid rerenders while dragging.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const fade = useTransform(x, [-480, -200, 0, 200, 480], [0.4, 1, 1, 1, 0.4]);

  const left = (stage.w - size.w) / 2 + depth * OFFSET;
  const topPx = (stage.h - size.h) / 2 + depth * OFFSET;

  const onPan = (_: PointerEvent, info: PanInfo) => {
    x.set(info.offset.x);
    y.set(info.offset.y * 0.6);
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    const keepY = y.get() * 1.6;
    if ((dx < -THRESHOLD || vx < -500) && canNext) { onNext(keepY); return; }
    if (dx > THRESHOLD || vx > 500) onPrev(keepY);
    animate(x, 0, transition);
    animate(y, 0, transition);
  };

  return (
    <motion.div
      custom={{ dir, y: 0 }}
      className="absolute shadow-[0_24px_60px_-20px_oklch(0_0_0/0.8)]"
      style={{ left: 0, top: 0, width: size.w, height: size.h, x: top ? x : 0, y: top ? y : 0, rotate: 0, touchAction: "none", zIndex: 10 - depth }}
      variants={{
        // Backward: the previous print returns from the left onto the front of the stack.
        enter: (c: { dir: number; y: number }) => (c.dir === -1 ? { x: -exitX, y: c.y, left, top: topPx, opacity: 0 } : { left: left + OFFSET, top: topPx + OFFSET, opacity: 0 }),
        // Forward: the top print leaves to the left, keeping some of the finger's vertical drift.
        exit: (c: { dir: number; y: number }) => (c.dir === 1 ? { x: -exitX, y: c.y, opacity: 0, transition } : { left: left + OFFSET * 2, top: topPx + OFFSET * 2, opacity: 0, transition }),
      }}
      initial="enter"
      animate={{ left, top: topPx, x: 0, y: 0, opacity: depth > DEPTH - 1 ? 0 : 1, rotate: 0, transition }}
      exit="exit"
      {...(top ? { onPan, onPanEnd } : {})}
    >
      <motion.img
        src={item.src}
        alt={item.alt ?? "Photograph"}
        width={item.w}
        height={item.h}
        draggable={false}
        decoding="async"
        className="h-full w-full select-none bg-charcoal object-cover"
        style={{ opacity: top ? fade : 1, cursor: top ? "grab" : "default" }}
      />
    </motion.div>
  );
}
