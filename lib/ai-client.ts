import { blobToDataURL } from "./images";
import type { ItemAttrs } from "./types";

export interface AiTagResult {
  attrs: Partial<ItemAttrs> & { brand?: string };
  available: boolean;
}

/**
 * Ask the server route (Claude vision) to tag a piece.
 * Returns { available:false } when no API key is configured or the call
 * fails — callers then keep the locally-detected attributes.
 */
export async function aiCategorize(thumb: Blob): Promise<AiTagResult> {
  try {
    const image = await blobToDataURL(thumb);
    const res = await fetch("/api/categorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    });
    if (res.status === 501) return { attrs: {}, available: false };
    if (!res.ok) return { attrs: {}, available: false };
    const data = await res.json();
    return { attrs: data.attrs ?? {}, available: true };
  } catch {
    return { attrs: {}, available: false };
  }
}
