/**
 * Custom watermark on delivered photos: the studio's own logo file, placed in one corner at the same
 * relative size on every photo (a share of the photo's shorter side), baked into full-size copies the
 * client downloads. Independent of the "watermark until paid" previews.
 */
export type Corner = "tl" | "tr" | "bl" | "br";
export type Brand = {
  /** On: the client downloads the copies with the logo; off: the untouched originals. */
  on: boolean;
  /** Logo file in the deliveries bucket. */
  logo: string;
  corner: Corner;
  /** Logo width as % of the photo's shorter side. */
  size: number;
  /** Gap to the edges as % of the photo's shorter side. */
  margin: number;
  /** 0.1–1. */
  opacity: number;
  /** Changes whenever the settings change; copies made with an older version are redone. */
  v: number;
};

export const BRAND_DEFAULT: Omit<Brand, "logo" | "v"> = { on: true, corner: "br", size: 18, margin: 4, opacity: 0.85 };

/** Where the logo goes on a w×h photo (pixels). */
export function placeLogo(w: number, h: number, lw: number, lh: number, b: Pick<Brand, "corner" | "size" | "margin">) {
  const short = Math.min(w, h);
  const width = (short * b.size) / 100;
  const height = lw ? (width * lh) / lw : width;
  const m = (short * b.margin) / 100;
  const x = b.corner === "tl" || b.corner === "bl" ? m : w - m - width;
  const y = b.corner === "tl" || b.corner === "tr" ? m : h - m - height;
  return { x, y, width, height };
}

/** Full-size copy of a photo with the logo drawn in; JPEG at maximum quality (PNG stays PNG). */
export async function bakeBrand(photo: Blob, logo: ImageBitmap, b: Brand): Promise<Blob> {
  const bmp = await createImageBitmap(photo);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the photo");
    ctx.drawImage(bmp, 0, 0);
    const p = placeLogo(bmp.width, bmp.height, logo.width, logo.height, b);
    ctx.globalAlpha = Math.min(1, Math.max(0.1, b.opacity));
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, p.x, p.y, p.width, p.height);
    const type = photo.type === "image/png" ? "image/png" : "image/jpeg";
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 1));
    if (!out) throw new Error("The photo is too large for this browser — try on a computer");
    return out;
  } finally {
    bmp.close();
  }
}

/** Folder of a delivery file's original ("<delivery>/<uuid>"). */
export const folderOf = (storagePath: string) => storagePath.slice(0, storagePath.lastIndexOf("/"));
/** Copy path: same file name as the original, so downloads keep the client's file names. */
export const brandedPathFor = (storagePath: string, v: number) => `${folderOf(storagePath)}/branded-${v}/${storagePath.slice(storagePath.lastIndexOf("/") + 1)}`;
