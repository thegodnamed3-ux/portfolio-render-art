import type { GalleryPhoto, VideoItem } from "./types";
import { automotive, commercial, couples, portraits, videos } from "./media";

export type Category = {
  slug: string;
  title: string;
  description: string;
  photos: GalleryPhoto[];
  videos: VideoItem[];
  /** Set when the discipline lives on another site: the row links out instead of opening an in-app gallery. */
  external?: string;
};

const cat = (slug: string, title: string, photos: GalleryPhoto[], v: VideoItem[] = []): Category => ({
  slug,
  title,
  description: `${title === "Video" ? "Video work" : `${title} photography`} by thegodnamed, Tallinn.`,
  photos,
  videos: v,
});

/** Photoshoot stacks themselves live in the database (managed at /admin). Order here drives the Disciplines list. */
export const categories: Category[] = [
  cat("portraits", "Portraits", portraits),
  cat("couples", "Couples", couples),
  cat("commercial", "Commercial", commercial),
  cat("automotive", "Automotive", automotive),
  cat("video", "Video", [], videos),
  // Real estate is presented on its own site, so the row links straight out.
  { ...cat("real-estate", "Real estate", []), external: "https://thehorastudios.wfolio.pro/" },
];

/** Disciplines with a gallery inside this site — drives the $category route and previous/next navigation. */
export const internalCategories = categories.filter((c) => !c.external);

export const getCategory = (slug: string) => internalCategories.find((c) => c.slug === slug);
