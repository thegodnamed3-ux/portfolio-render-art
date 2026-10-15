import type { GalleryPhoto } from "./types";

/** One photoshoot: Category → Session → ordered images. */
export type Session = {
  id: string;
  category: string;
  /** Original Wfolio album name */
  album: string;
  title: string;
  cover: GalleryPhoto;
  images: GalleryPhoto[];
  count: number;
};

const MAX = 12;

/** Evenly samples up to `max` frames so long albums keep variety instead of near-duplicates. */
function sample(list: GalleryPhoto[], max = MAX) {
  if (list.length <= max) return list;
  return Array.from({ length: max }, (_, i) => list[Math.round((i * (list.length - 1)) / (max - 1))]!);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Groups a category's photos by their original album, preserving album order. */
export function toSessions(category: string, photos: GalleryPhoto[]): Session[] {
  const groups = new Map<string, GalleryPhoto[]>();
  photos.forEach((p) => groups.set(p.project, [...(groups.get(p.project) ?? []), p]));
  return [...groups].map(([album, list]) => {
    const images = sample(list);
    return { id: `${category}-${slug(album)}`, category, album, title: album, cover: images[0]!, images, count: images.length };
  });
}
