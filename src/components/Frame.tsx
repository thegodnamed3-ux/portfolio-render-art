import { cn } from "@/lib/utils";

export type FramePhoto = { src: string; w: number; h: number; sm?: string };

type Props = {
  photo: FramePhoto;
  index?: string;
  caption?: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  onOpen?: () => void;
  /** Purely visual: no click target, no hover motion, no pointer cursor. */
  static?: boolean;
};

/** Photograph at its native aspect ratio with small editorial caption. */
export function Frame({ photo, index, caption, className, eager, sizes, onOpen, static: isStatic }: Props) {
  const img = (
    <div className="overflow-hidden bg-charcoal" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
      <img
        src={photo.src}
        srcSet={photo.sm ? `${photo.sm} 600w, ${photo.src} 1240w` : undefined}
        sizes={photo.sm ? (sizes ?? "(min-width: 768px) 50vw, 100vw") : undefined}
        alt={caption ?? "Portrait photograph"}
        width={photo.w}
        height={photo.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-full w-full object-cover",
          !isStatic && "transition-transform duration-700 ease-out group-hover:scale-[1.025]",
        )}
      />
    </div>
  );
  return (
    <figure className={cn(!isStatic && "group", className)}>
      {onOpen && !isStatic ? (
        <button type="button" onClick={onOpen} aria-label={`Open ${caption ?? "photograph"} fullscreen`} className="block w-full cursor-zoom-in">
          {img}
        </button>
      ) : img}
      {(index || caption) && (
        <figcaption className="meta mt-3 flex justify-between text-muted-foreground">
          <span>{caption}</span>
          <span>{index}</span>
        </figcaption>
      )}
    </figure>
  );
}
