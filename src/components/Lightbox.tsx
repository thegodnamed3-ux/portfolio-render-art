import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ContactLinks } from "./ContactLinks";

export type ViewerItem = { src: string; w: number; h: number; alt?: string };

type Ctx = { open: (items: ViewerItem[], index: number) => void };
const LightboxContext = createContext<Ctx>({ open: () => {} });
export const useLightbox = () => useContext(LightboxContext);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const open = useCallback((items: ViewerItem[], index: number) => {
    setState({ items, index });
    requestAnimationFrame(() => setVisible(true));
  }, []);
  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setState(null), 300);
  }, []);
  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {state && (
        <Viewer
          items={state.items}
          index={state.index}
          visible={visible}
          onIndex={(index) => setState((s) => (s ? { ...s, index } : s))}
          onClose={close}
        />
      )}
    </LightboxContext.Provider>
  );
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 stroke-current" strokeWidth="1.4" fill="none"><path d="M5 5l14 14M19 5 5 19" /></svg>
);

function Viewer({ items, index, visible, onIndex, onClose }: {
  items: ViewerItem[]; index: number; visible: boolean; onIndex: (i: number) => void; onClose: () => void;
}) {
  const [panel, setPanel] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = items[index]!;
  const n = items.length;
  const go = useCallback((d: number) => { setLoaded(false); onIndex((index + d + n) % n); }, [index, n, onIndex]);

  // Lock background scroll; overflow lock keeps the scroll position intact.
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

  // Preload neighbours
  useEffect(() => {
    [1, -1].forEach((d) => { const img = new Image(); img.src = items[(index + d + n) % n]!.src; });
  }, [index, items, n]);

  const ctrl = "meta text-paper/60 transition-colors hover:text-paper";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className={`fixed inset-0 z-[100] flex flex-col bg-viewer transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onTouchStart={(e) => { const t = e.touches[0]!; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => {
        const s = touch.current; touch.current = null;
        if (!s || panel) return;
        const t = e.changedTouches[0]!; const dx = t.clientX - s.x; const dy = t.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 md:px-8 md:py-6">
        <span className="meta text-paper/45">{String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
        <button onClick={onClose} aria-label="Close viewer" className="-m-2 p-2 text-paper/70 transition-colors hover:text-paper"><CloseIcon /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 md:px-20" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img
          key={item.src}
          src={item.src}
          alt={item.alt ?? "Photograph"}
          width={item.w}
          height={item.h}
          onLoad={() => setLoaded(true)}
          className={`max-h-full max-w-full select-none object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ aspectRatio: `${item.w} / ${item.h}` }}
          draggable={false}
        />
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute inset-y-0 left-0 hidden w-20 items-center justify-center text-paper/40 transition-colors hover:text-paper md:flex">←</button>
            <button onClick={() => go(1)} aria-label="Next photo" className="absolute inset-y-0 right-0 hidden w-20 items-center justify-center text-paper/40 transition-colors hover:text-paper md:flex">→</button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-paper/10 px-5 py-4 md:border-0 md:px-8 md:py-6">
        <div className="flex gap-6 md:invisible">
          <button onClick={() => go(-1)} aria-label="Previous photo" className={ctrl}>← Prev</button>
          <button onClick={() => go(1)} aria-label="Next photo" className={ctrl}>Next →</button>
        </div>
        <button onClick={() => setPanel(true)} className={`${ctrl} border-b border-paper/25 pb-0.5 hover:border-paper`}>Book a session</button>
      </div>

      {panel && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-viewer/70 md:items-center" onClick={(e) => { if (e.target === e.currentTarget) setPanel(false); }}>
          <div role="dialog" aria-label="Book a session" className="w-full border-t border-paper/15 bg-background p-6 md:max-w-md md:border md:p-8">
            <div className="mb-8 flex items-baseline justify-between">
              <p className="display text-3xl text-paper">Book a session.</p>
              <button onClick={() => setPanel(false)} aria-label="Close booking panel" className="-m-2 p-2 text-paper/70 hover:text-paper"><CloseIcon /></button>
            </div>
            <ContactLinks tone="dark" />
          </div>
        </div>
      )}
    </div>
  );
}
