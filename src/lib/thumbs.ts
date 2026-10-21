/**
 * Small JPEG copy of a photo (longest side ≤ 900px) for grids. Made in the browser, so the
 * original file is never touched. Returns null when the browser can't read the image.
 */
export async function makeThumb(source: Blob, max = 900): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(source);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close(); return null; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.82));
  } catch {
    return null;
  }
}
