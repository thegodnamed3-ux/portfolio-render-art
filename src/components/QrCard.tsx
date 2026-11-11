import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** QR for https://thegodnamed.ee/ (version 2, error correction M): 25 rows of modules, 1 = dark. */
const QR_ROWS = "1111111001101000101111111,1000001001000011101000001,1011101010100011101011101,1011101010111110001011101,1011101011111000101011101,1000001011010011101000001,1111111010101010101111111,0000000010110001000000000,1011111000010101001111100,0111100000100100100100010,0110011001010111000001011,1001000100011000101100001,1011111010111110011110111,1101010011100000100101010,1010111111011011011111011,1000110011110011111110001,1001001110010111111110100,0000000011001001100011000,1111111000000010101010111,1000001010101010100011010,1011101011101101111110111,1011101011000100111011111,1011101011011110100001101,1000001001110011111111001,1111111011011000010111111".split(",");
const QR_N = QR_ROWS.length;

/**
 * Soft QR: rounded modules and rounded corner squares, light on the dark card. The rounding stays
 * moderate (checked with a decoder) so phone cameras still read it; the quiet zone is 4 modules.
 */
function SoftQr() {
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= QR_N - 7) || (r >= QR_N - 7 && c < 7);
  const cells: ReactNode[] = [];
  QR_ROWS.forEach((row, r) => {
    for (let c = 0; c < QR_N; c++) {
      if (row[c] === "1" && !inFinder(r, c)) cells.push(<rect key={`${r}-${c}`} x={c + 0.06} y={r + 0.06} width={0.88} height={0.88} rx={0.3} />);
    }
  });
  const finder = (x: number, y: number) => (
    <g key={`f${x}-${y}`}>
      <path fillRule="evenodd" d={`M${x + 1.5} ${y}h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5zM${x + 2} ${y + 1}h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z`} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} />
    </g>
  );
  return (
    <svg viewBox={`-4 -4 ${QR_N + 8} ${QR_N + 8}`} role="img" aria-label="QR code: thegodnamed.ee" className="aspect-square w-full fill-paper/90">
      {cells}
      {finder(0, 0)}{finder(QR_N - 7, 0)}{finder(0, QR_N - 7)}
    </svg>
  );
}

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
  // Where the button sits relative to the screen centre: the card grows out of it and shrinks back into it.
  const [from, setFrom] = useState({ x: 0, y: 0 });
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
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setFrom({ x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 });
          setOpen(true);
        }}
        aria-label="Business card with QR code"
        title="QR"
        className={cn("hit inline-grid place-items-center px-1 py-1.5 transition-[opacity,transform] duration-150 ease-out hover:opacity-60 active:scale-[0.82]", className)}
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
              // The glass clears a little after the card has started back toward the button.
              exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.45, delay: reduce ? 0 : 0.12, ease } }}
              transition={{ duration: reduce ? 0 : 0.35, ease }}
            >
              <motion.figure
                onClick={(e) => e.stopPropagation()}
                className="flex w-[min(20rem,100%)] flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-[#1c1c1c]/85 px-6 pb-7 pt-6 text-paper shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl"
                initial={{ opacity: 0, x: from.x, y: from.y, scale: 0.08, borderRadius: 80, filter: "blur(14px)" }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1, borderRadius: 28, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: from.x, y: from.y, scale: 0.08, borderRadius: 80, filter: "blur(14px)" }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26, mass: 0.9, opacity: { duration: 0.3 }, filter: { duration: 0.4 } }}
              >
                <SoftQr />
                <figcaption className="flex flex-col items-center gap-1.5 text-center">
                  <span className="wordmark text-xl">thegodnamed</span>
                  <span className="meta text-[0.6875rem] tracking-[0.2em] text-paper/55">PHOTOGRAPHY · VISUALS</span>
                  <span className="meta mt-1 text-[0.75rem] text-paper/70">thegodnamed.ee</span>
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
