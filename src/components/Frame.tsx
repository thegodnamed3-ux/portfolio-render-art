import { useCallback, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { originOf, type ViewerOrigin } from "@/components/Lightbox";
import { cn } from "@/lib/utils";

export type FramePhoto = { src: string; w: number; h: number; sm?: string; pos?: string };

type Props = {
  photo: FramePhoto;
  index?: string;
  caption?: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  /** Receives where the photo sits on screen, so the viewer can zoom out of it. */
  onOpen?: (origin?: ViewerOrigin) => void;
  /** Purely visual: no click target, no pointer cursor. */
  static?: boolean;
  /** Gentle zoom + brighter caption on hover (on by default for clickable frames). */
  hover?: boolean;
  /** Rise into view when scrolled to, after this many seconds. */
  reveal?: number;
  style?: CSSProperties;
};

/** Fades a photo in once it has actually loaded, instead of popping in. */
export function useFadeIn() {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  return { ref, loaded, onLoad: () => setLoaded(true), onError: () => setLoaded(true) };
}

/** Photograph at its native aspect ratio with small editorial caption. */
export function Frame({ photo, index, caption, className, eager, sizes, onOpen, static: isStatic, hover, reveal, style }: Props) {
  const fade = useFadeIn();
  const reduce = useReducedMotion();
  const zoom = hover ?? !isStatic;
  const img = (
    <div className="overflow-hidden bg-charcoal" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
      <img
        ref={fade.ref}
        onLoad={fade.onLoad}
        onError={fade.onError}
        data-fade=""
        src={photo.src}
        srcSet={photo.sm ? `${photo.sm} 600w, ${photo.src} 1240w` : undefined}
        sizes={photo.sm ? (sizes ?? "(min-width: 768px) 50vw, 100vw") : undefined}
        alt={caption ?? "Portrait photograph"}
        width={photo.w}
        height={photo.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={photo.pos ? { objectPosition: photo.pos } : undefined}
        className={cn(
          "h-full w-full object-cover [transition:opacity_500ms_ease-out,transform_900ms_cubic-bezier(0.2,0.7,0.1,1)]",
          fade.loaded ? "opacity-100" : "opacity-0",
          zoom && "group-hover:scale-[1.03]",
        )}
      />
    </div>
  );
  const body = (
    <>
      {onOpen && !isStatic ? (
        <button
          type="button"
          onClick={(e) => onOpen(originOf(e.currentTarget.firstElementChild))}
          aria-label={`Open ${caption ?? "photograph"} fullscreen`}
          className="block w-full cursor-zoom-in"
        >
          {img}
        </button>
      ) : img}
      {(index || caption) && (
        <figcaption className={cn("meta mt-3 flex justify-between text-muted-foreground", zoom && "transition-colors duration-500 group-hover:text-paper/85")}>
          <span>{caption}</span>
          <span>{index}</span>
        </figcaption>
      )}
    </>
  );
  const cls = cn(zoom && "group", className);
  if (reveal === undefined) return <figure className={cls} style={style}>{body}</figure>;
  return (
    <motion.figure
      className={cls}
      style={style}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.9, delay: reveal, ease: [0.2, 0.7, 0.1, 1] }}
    >
      {body}
    </motion.figure>
  );
}
