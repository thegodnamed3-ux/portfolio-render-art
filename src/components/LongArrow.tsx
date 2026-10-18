import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/** One continuous stroke (shaft + head) drawn to the button's measured width, so it never looks pieced together. */
export function LongArrow({ left }: { left: boolean }) {
  const [w, setW] = useState(32);
  const ref = useCallback((el: SVGSVGElement | null) => {
    if (!el) return;
    const measure = () => setW(Math.max(12, Math.round(el.getBoundingClientRect().width)));
    measure();
    new ResizeObserver(measure).observe(el);
  }, []);
  const d = `M1 5H${w - 1}M${w - 4.5} 1.5L${w - 1} 5L${w - 4.5} 8.5`;
  return (
    <svg ref={ref} viewBox={`0 0 ${w} 10`} aria-hidden className={cn("h-[0.6875rem] w-full fill-none stroke-current", left && "-scale-x-100")} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
