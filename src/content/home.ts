import { photos } from "@/lib/photos";
import type { HomeImage } from "@/lib/portfolio.functions";

const p = (n: number) => photos[n - 1]!;
/** Used until slides / portrait are saved in the studio. */
export const defaultHero: HomeImage[] = [{ ...p(11), pos: "60% 50%" }, { ...p(26) }, { ...p(3) }, { ...p(5) }];
export const defaultAbout: HomeImage = { ...p(7) };
