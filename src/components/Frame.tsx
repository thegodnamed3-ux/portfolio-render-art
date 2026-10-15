import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

type Props = {
  photo: Photo;
  index?: string;
  caption?: string;
  className?: string;
  eager?: boolean;
};

/** Photograph at its native aspect ratio with small editorial caption. */
export function Frame({ photo, index, caption, className, eager }: Props) {
  return (
    <figure className={cn("group", className)}>
      <div className="overflow-hidden bg-charcoal" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
        <img
          src={photo.src}
          alt={caption ?? "Portrait photograph"}
          width={photo.w}
          height={photo.h}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
        />
      </div>
      {(index || caption) && (
        <figcaption className="meta mt-3 flex justify-between text-muted-foreground">
          <span>{caption}</span>
          <span>{index}</span>
        </figcaption>
      )}
    </figure>
  );
}
