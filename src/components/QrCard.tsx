import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** QR for https://thegodnamed.ee/ (version 2, error correction M), drawn as one SVG path on a 25-module grid. */
const QR_SIZE = 25;
const QR_PATH = "M0 0h7v1h-7zM9 0h2v1h-2zM12 0h1v1h-1zM16 0h1v1h-1zM18 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM14 1h3v1h-3zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h1v1h-1zM10 2h1v1h-1zM14 2h3v1h-3zM18 2h1v1h-1zM20 2h3v1h-3zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM10 3h5v1h-5zM18 3h1v1h-1zM20 3h3v1h-3zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h5v1h-5zM16 4h1v1h-1zM18 4h1v1h-1zM20 4h3v1h-3zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h1v1h-1zM14 5h3v1h-3zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h7v1h-7zM8 7h1v1h-1zM10 7h2v1h-2zM15 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM11 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM18 8h5v1h-5zM1 9h4v1h-4zM10 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM23 9h1v1h-1zM1 10h2v1h-2zM5 10h2v1h-2zM9 10h1v1h-1zM11 10h1v1h-1zM13 10h3v1h-3zM21 10h1v1h-1zM23 10h2v1h-2zM0 11h1v1h-1zM3 11h1v1h-1zM7 11h1v1h-1zM11 11h2v1h-2zM16 11h1v1h-1zM18 11h2v1h-2zM24 11h1v1h-1zM0 12h1v1h-1zM2 12h5v1h-5zM8 12h1v1h-1zM10 12h5v1h-5zM17 12h4v1h-4zM22 12h3v1h-3zM0 13h2v1h-2zM3 13h1v1h-1zM5 13h1v1h-1zM8 13h3v1h-3zM16 13h1v1h-1zM19 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM4 14h6v1h-6zM11 14h2v1h-2zM14 14h2v1h-2zM17 14h5v1h-5zM23 14h2v1h-2zM0 15h1v1h-1zM4 15h2v1h-2zM8 15h4v1h-4zM14 15h7v1h-7zM24 15h1v1h-1zM0 16h1v1h-1zM3 16h1v1h-1zM6 16h3v1h-3zM11 16h1v1h-1zM13 16h8v1h-8zM22 16h1v1h-1zM8 17h2v1h-2zM12 17h1v1h-1zM15 17h2v1h-2zM20 17h2v1h-2zM0 18h7v1h-7zM14 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM22 18h3v1h-3zM0 19h1v1h-1zM6 19h1v1h-1zM8 19h1v1h-1zM10 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM20 19h2v1h-2zM23 19h1v1h-1zM0 20h1v1h-1zM2 20h3v1h-3zM6 20h1v1h-1zM8 20h3v1h-3zM12 20h2v1h-2zM15 20h6v1h-6zM22 20h3v1h-3zM0 21h1v1h-1zM2 21h3v1h-3zM6 21h1v1h-1zM8 21h2v1h-2zM13 21h1v1h-1zM16 21h3v1h-3zM20 21h5v1h-5zM0 22h1v1h-1zM2 22h3v1h-3zM6 22h1v1h-1zM8 22h2v1h-2zM11 22h4v1h-4zM16 22h1v1h-1zM21 22h2v1h-2zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM9 23h3v1h-3zM14 23h8v1h-8zM24 23h1v1h-1zM0 24h7v1h-7zM8 24h2v1h-2zM11 24h2v1h-2zM17 24h1v1h-1zM19 24h6v1h-6z";

function QrGlyph({ className }: { className?: string }) {
  // Small QR mark for the button: three corner squares and a few dots.
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("fill-none stroke-current", className)} strokeWidth="1.3">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M10 10h1.5M13.5 10v1.5M10 13.5h4.5M12 12h0" strokeLinecap="round" />
    </svg>
  );
}

/** A small button that blurs the whole screen like liquid glass and brings up a business card with a QR code. */
export function QrCardButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { html.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const ease = [0.2, 0.8, 0.2, 1] as const;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Business card with QR code"
        title="QR"
        className={cn("hit inline-grid place-items-center px-1 py-1.5 transition-opacity hover:opacity-60", className)}
      >
        <QrGlyph className="size-[0.9rem]" />
      </button>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="qr"
              role="dialog"
              aria-modal="true"
              aria-label="thegodnamed — QR code"
              className="fixed inset-0 z-[130] flex items-center justify-center bg-white/[0.06] p-6 backdrop-blur-2xl backdrop-saturate-150"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.35, ease }}
            >
              <motion.figure
                onClick={(e) => e.stopPropagation()}
                className="flex w-[min(20rem,100%)] flex-col items-center gap-5 rounded-[28px] bg-paper px-8 pb-7 pt-8 text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]"
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: reduce ? 0 : 0.5, ease }}
              >
                <svg viewBox={`-2 -2 ${QR_SIZE + 4} ${QR_SIZE + 4}`} role="img" aria-label="QR code: thegodnamed.ee" className="aspect-square w-full" shapeRendering="crispEdges">
                  <path d={QR_PATH} className="fill-ink" />
                </svg>
                <figcaption className="flex flex-col items-center gap-1.5 text-center">
                  <span className="wordmark text-xl">thegodnamed</span>
                  <span className="meta text-[0.6875rem] tracking-[0.2em] text-ink/60">PHOTOGRAPHY · VISUALS</span>
                  <span className="meta mt-1 text-[0.75rem] text-ink/75">thegodnamed.ee</span>
                </figcaption>
              </motion.figure>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
