import type { CSSProperties } from "react";
import { Frame } from "@/components/Frame";
import type { WorkItem } from "@/content/home";
import { cn } from "@/lib/utils";

/**
 * "Selected works" layout. Desktop: `columns` equal frames per row; an unfinished last
 * row is centred (the grid has twice as many tracks as frames, so a half-frame offset is
 * possible). Phone: two per row, and with an odd count the first frame runs full width.
 * `force` pins one layout regardless of screen size — used by the studio previews.
 */
export function WorkGrid({ items, columns, mobileColumns = 2, force }: { items: WorkItem[]; columns: number; mobileColumns?: number; force?: "desktop" | "mobile" }) {
  const m = Math.max(1, Math.min(3, Math.round(mobileColumns)));
  const n = items.length;
  const cols = Math.max(2, Math.min(6, Math.round(columns)));
  const rest = n % cols;
  const lastRowStart = rest ? n - rest : -1;
  const centreAt = rest ? cols - rest + 1 : 1; // grid line in the doubled track grid
  // With two per row and an odd count, the first frame runs full width on phones.
  const odd = m === 2 && n % 2 === 1;

  const desktop = force === "desktop";
  const mobile = force === "mobile";
  const gridStyle: CSSProperties & Record<string, string | number> = { "--tracks": cols * 2, "--m": m };
  if (desktop) gridStyle.gridTemplateColumns = `repeat(${cols * 2}, minmax(0, 1fr))`;

  return (
    <div
      style={gridStyle}
      className={cn(
        "grid",
        desktop ? "gap-x-6 gap-y-10" : mobile ? "[grid-template-columns:repeat(var(--m),minmax(0,1fr))] gap-x-3 gap-y-6" : "[grid-template-columns:repeat(var(--m),minmax(0,1fr))] gap-x-3 gap-y-8 md:gap-x-6 md:gap-y-12 md:[grid-template-columns:repeat(var(--tracks),minmax(0,1fr))]",
      )}
    >
      {items.map((it, i) => {
        const wideOnPhone = odd && i === 0;
        const style: CSSProperties = {};
        if (desktop) {
          style.gridColumn = i === lastRowStart ? `${centreAt} / span 2` : "span 2";
        } else if (mobile) {
          style.gridColumn = wideOnPhone ? "span 2" : "span 1";
        } else if (i === lastRowStart) {
          (style as Record<string, string>)["--start"] = String(centreAt);
        }
        return (
          <Frame
            key={`${it.src}-${i}`}
            static
            hover
            reveal={(i % cols) * 0.15}
            photo={it}
            {...(it.caption ? { caption: it.caption } : {})}
            index={String(i + 1).padStart(2, "0")}
            sizes={`(min-width: 768px) ${Math.round(100 / cols)}vw, ${wideOnPhone ? 100 : Math.round(100 / m)}vw`}
            className={cn(
              !force && (wideOnPhone ? "col-span-2" : "col-span-1"),
              !force && (i === lastRowStart ? "md:[grid-column:var(--start)/span_2]" : "md:col-span-2"),
            )}
            {...(Object.keys(style).length ? { style } : {})}
          />
        );
      })}
    </div>
  );
}
