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
