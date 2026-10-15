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

/** Order here drives the Disciplines list. */
export const categories: Category[] = [
  { slug: "portraits", title: "Portraits", description: "Portrait photography by thegodnamed, Tallinn.", photos: portraits, videos: [] },
  { slug: "couples", title: "Couples", description: "Couple photography by thegodnamed, Tallinn.", photos: couples, videos: [] },
  { slug: "commercial", title: "Commercial", description: "Commercial photography by thegodnamed, Tallinn.", photos: commercial, videos: [] },
  { slug: "automotive", title: "Automotive", description: "Automotive photography by thegodnamed, Tallinn.", photos: automotive, videos: [] },
  { slug: "video", title: "Video", description: "Video work by thegodnamed, Tallinn.", photos: [], videos },
  // Real estate is presented on its own site, so the row links straight out.
  {
    slug: "real-estate",
    title: "Real estate",
    description: "Real estate photography by thegodnamed, Tallinn.",
    photos: [],
    videos: [],
    external: "https://thehorastudios.wfolio.pro/",
  },
];

/** Disciplines with a gallery inside this site — drives the $category route and previous/next navigation. */
export const internalCategories = categories.filter((c) => !c.external);

export const getCategory = (slug: string) => internalCategories.find((c) => c.slug === slug);
