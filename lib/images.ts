/**
 * Client-side image pipeline: background removal (on-device model),
 * alpha-trim, resize, webp export.
 */

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

function draw(bmp: ImageBitmap | HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return c;
}

/** Crop to the visible (non-transparent) region with a little breathing room. */
function trimAlpha(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxX - minX < 8 || maxY - minY < 8) return src;
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function resizeMax(src: HTMLCanvasElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  if (scale === 1) return src;
  return draw(src, Math.round(src.width * scale), Math.round(src.height * scale));
}

export interface ProcessResult {
  image: Blob;
  thumb: Blob;
  bgRemoved: boolean;
}

export type BgProgress = (pct: number, stage: string) => void;

/**
 * Remove the backdrop with the on-device ISNet model (first use downloads
 * ~40 MB of model weights, cached by the browser afterwards).
 * Falls back to the original photo if anything goes wrong.
 */
export async function removeBg(blob: Blob, onProgress?: BgProgress): Promise<{ blob: Blob; ok: boolean }> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const out = await removeBackground(blob, {
      model: "isnet_quint8",
      output: { format: "image/png", quality: 1 },
      progress: (key, current, total) => {
        if (!onProgress || !total) return;
        const pct = Math.round((current / total) * 100);
        onProgress(pct, key.startsWith("fetch") ? "model" : "cutout");
      },
    });
    return { blob: out, ok: true };
  } catch (err) {
    console.warn("[armoire] background removal unavailable, keeping original", err);
    return { blob, ok: false };
  }
}

/** Normalize any input image into display + thumb webp blobs. */
export async function finalizeImage(blob: Blob, bgRemoved: boolean): Promise<ProcessResult> {
  const bmp = await blobToBitmap(blob);
  let canvas = draw(bmp, bmp.width, bmp.height);
  bmp.close();
  if (bgRemoved) canvas = trimAlpha(canvas);
  const display = resizeMax(canvas, 1000);
  const thumbC = resizeMax(canvas, 420);
  const image = await canvasToBlob(display, "image/webp", 0.9);
  const thumb = await canvasToBlob(thumbC, "image/webp", 0.82);
  return { image, thumb, bgRemoved };
}

export async function processUpload(
  file: Blob,
  wantBgRemoval: boolean,
  onProgress?: BgProgress,
): Promise<ProcessResult> {
  if (!wantBgRemoval) return finalizeImage(file, false);
  const { blob, ok } = await removeBg(file, onProgress);
  return finalizeImage(blob, ok);
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
