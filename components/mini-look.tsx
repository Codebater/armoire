"use client";

import clsx from "clsx";
import type { Item } from "@/lib/types";
import { BlobImg } from "./ui";

export interface LookParts {
  top?: Item;
  bottom?: Item;
  dress?: Item;
  shoes?: Item;
  outer?: Item;
  bag?: Item;
}

export function partsFromItems(items: Item[]): LookParts {
  const parts: LookParts = {};
  for (const i of items) {
    if (i.kind === "top" && !parts.top) parts.top = i;
    else if (i.kind === "bottom" && !parts.bottom) parts.bottom = i;
    else if (i.kind === "dress" && !parts.dress) parts.dress = i;
    else if (i.kind === "shoes" && !parts.shoes) parts.shoes = i;
    else if (i.kind === "outer" && !parts.outer) parts.outer = i;
    else if (i.kind === "bag" && !parts.bag) parts.bag = i;
  }
  return parts;
}

/** Tiny collage preview of a look — used in sheets, planner, saved looks. */
export function MiniLook({ parts, className }: { parts: LookParts; className?: string }) {
  return (
    <div className={clsx("relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-card", className)}>
      {parts.dress ? (
        <BlobImg blob={parts.dress.thumb} className="absolute inset-x-2 inset-y-1 h-[calc(100%-8px)] w-[calc(100%-16px)] object-contain" />
      ) : (
        <>
          {parts.top && (
            <BlobImg blob={parts.top.thumb} className="absolute inset-x-2 top-0.5 h-[54%] w-[calc(100%-16px)] object-contain" />
          )}
          {parts.bottom && (
            <BlobImg blob={parts.bottom.thumb} className="absolute inset-x-2 bottom-0.5 h-[54%] w-[calc(100%-16px)] object-contain" />
          )}
        </>
      )}
      {parts.outer && (
        <BlobImg blob={parts.outer.thumb} className="absolute left-0.5 top-0.5 h-9 w-8 -rotate-6 object-contain opacity-90" />
      )}
      {parts.shoes && (
        <BlobImg blob={parts.shoes.thumb} className="absolute bottom-0.5 right-0.5 h-7 w-9 object-contain" />
      )}
    </div>
  );
}
