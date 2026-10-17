import { photos } from "@/lib/photos";
import type { HomeImage } from "@/lib/portfolio.functions";

const p = (n: number) => photos[n - 1]!;
/** Used until slides / portrait are saved in the studio. */
export const defaultHero: HomeImage[] = [{ ...p(11), pos: "60% 50%" }, { ...p(26) }, { ...p(3) }, { ...p(5) }];
export const defaultAbout: HomeImage = { ...p(7) };

/** "Selected works" until it is arranged in the studio. */
export type WorkItem = HomeImage & { caption?: string };
export const defaultWork: WorkItem[] = [
  { ...p(3), caption: "Coastline" },
  { ...p(13), caption: "Red room" },
  { ...p(26), caption: "Edge of the cliff" },
  { ...p(8), caption: "Blue hour" },
  { ...p(5), caption: "Couples — sunset" },
];
export const defaultWorkColumns = 3;
