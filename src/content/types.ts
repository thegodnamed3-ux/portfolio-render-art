export type GalleryPhoto = {
  /** ~600px wide, for small thumbnails */
  sm: string;
  /** ~1240px wide, for gallery display */
  src: string;
  /** Largest available rendition, used in the fullscreen viewer */
  full: string;
  w: number;
  h: number;
  /** Project / session the photo belongs to */
  project: string;
};

export type VideoItem = { id: string; title: string };
