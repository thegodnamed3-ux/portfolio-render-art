import type { GalleryPhoto, VideoItem } from "./types";
import { automotive, commercial, couples, portraits, videos } from "./media";

export type Category = {
  slug: string;
  title: string;
  description: string;
  photos: GalleryPhoto[];
  videos: VideoItem[];
};

/** Order here drives the Disciplines list and previous/next navigation. */
export const categories: Category[] = [
  { slug: "portraits", title: "Portraits", description: "Portrait photography by thegodnamed, Tallinn.", photos: portraits, videos: [] },
  { slug: "couples", title: "Couples", description: "Couple photography by thegodnamed, Tallinn.", photos: couples, videos: [] },
  { slug: "commercial", title: "Commercial", description: "Commercial photography by thegodnamed, Tallinn.", photos: commercial, videos: [] },
  { slug: "automotive", title: "Automotive", description: "Automotive photography by thegodnamed, Tallinn.", photos: automotive, videos: [] },
  { slug: "video", title: "Video", description: "Video work by thegodnamed, Tallinn.", photos: [], videos },
  // Real estate: no original work on the Wfolio site yet — add photos here.
  { slug: "real-estate", title: "Real estate", description: "Real estate photography by thegodnamed, Tallinn.", photos: [], videos: [] },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
