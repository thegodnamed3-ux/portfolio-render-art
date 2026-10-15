import { useState } from "react";
import type { GalleryPhoto, VideoItem } from "@/content/types";
import { Frame } from "./Frame";
import { useLightbox } from "./Lightbox";

type Row = { kind: "wide"; i: number } | { kind: "pair"; a: number; b?: number };

/** Groups photos by orientation: landscapes get their own row, portraits pair up. */
function rows(photos: GalleryPhoto[]): Row[] {
  const out: Row[] = [];
  let pending: number | null = null;
  photos.forEach((p, i) => {
    if (p.w > p.h) {
      out.push({ kind: "wide", i });
    } else if (pending === null) {
      pending = i;
    } else {
      out.push({ kind: "pair", a: pending, b: i });
      pending = null;
    }
  });
  if (pending !== null) out.push({ kind: "pair", a: pending });
  return out;
}

const wideSpans = ["md:col-span-12", "md:col-span-9", "md:col-span-9 md:col-start-4", "md:col-span-10 md:col-start-2"];
const pairSpans: [string, string][] = [
  ["w-5/6 md:col-span-5 md:w-full", "w-4/6 justify-self-end md:col-span-4 md:col-start-8 md:mt-40 md:w-full"],
  ["w-4/6 md:col-span-4 md:col-start-2 md:mt-28 md:w-full", "w-5/6 justify-self-end md:col-span-5 md:col-start-7 md:w-full"],
  ["w-5/6 md:col-span-6 md:w-full", "w-4/6 justify-self-end md:col-span-3 md:col-start-9 md:self-end md:w-full"],
];

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const { open } = useLightbox();
  const items = photos.map((p) => ({ src: p.full, w: p.w, h: p.h, alt: p.project }));
  const frame = (i: number, className: string, sizes: string) => (
    <Frame key={i} photo={photos[i]!} caption={photos[i]!.project} index={String(i + 1).padStart(2, "0")} className={className} sizes={sizes} eager={i < 2} onOpen={() => open(items, i)} />
  );
  let w = 0;
  let pr = 0;
  return (
    <div className="space-y-16 md:space-y-32">
      {rows(photos).map((r, k) => {
        if (r.kind === "wide") {
          const span = wideSpans[w++ % wideSpans.length]!;
          return <div key={k} className="grid md:grid-cols-12">{frame(r.i, span, "(min-width: 768px) 80vw, 100vw")}</div>;
        }
        const [sa, sb] = pairSpans[pr++ % pairSpans.length]!;
        return (
          <div key={k} className="grid items-start gap-16 md:grid-cols-12 md:gap-10">
            {frame(r.a, sa, "(min-width: 768px) 40vw, 85vw")}
            {r.b !== undefined && frame(r.b, sb, "(min-width: 768px) 40vw, 70vw")}
          </div>
        );
      })}
    </div>
  );
}

function VideoCard({ v, n }: { v: VideoItem; n: number }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure>
      <div className="relative aspect-video overflow-hidden bg-charcoal">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
            title={v.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${v.title}`} className="group absolute inset-0">
            <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.02] group-hover:opacity-100" />
            <span className="meta absolute bottom-4 left-4 border border-paper/40 px-3 py-2 text-paper transition-colors group-hover:bg-paper group-hover:text-ink">▶ Play</span>
          </button>
        )}
      </div>
      <figcaption className="meta mt-3 flex justify-between text-muted-foreground">
        <span>{v.title}</span>
        <span>{String(n).padStart(2, "0")}</span>
      </figcaption>
    </figure>
  );
}

export function VideoGallery({ videos }: { videos: VideoItem[] }) {
  return (
    <div className="grid gap-16 md:grid-cols-12 md:gap-x-10 md:gap-y-32">
      {videos.map((v, i) => (
        <div key={v.id} className={i % 3 === 0 ? "md:col-span-10" : i % 3 === 1 ? "md:col-span-6" : "md:col-span-5 md:col-start-8 md:mt-32"}>
          <VideoCard v={v} n={i + 1} />
        </div>
      ))}
    </div>
  );
}
