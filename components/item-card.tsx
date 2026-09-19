"use client";

import Link from "next/link";
import type { Item } from "@/lib/types";
import { IDrop, IHeart } from "./icons";
import { BlobImg, ColorDots } from "./ui";

export function ItemCard({ item, wearCount }: { item: Item; wearCount?: number }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="relative aspect-square p-4">
        <BlobImg
          blob={item.thumb}
          alt={item.name}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute left-2.5 top-2.5 flex gap-1">
          {item.fav === 1 && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-card/90 text-clay shadow-sm">
              <IHeart filled style={{ width: 12, height: 12 }} />
            </span>
          )}
          {item.laundry === 1 && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-card/90 shadow-sm" style={{ color: "#54718F" }} title="In laundry">
              <IDrop style={{ width: 12, height: 12 }} />
            </span>
          )}
        </div>
        {wearCount !== undefined && wearCount > 0 && (
          <span className="absolute bottom-2 right-2.5 rounded-full bg-linefaint px-2 py-0.5 text-[10px] font-semibold text-muted">
            {wearCount}×
          </span>
        )}
      </div>
      <div className="border-t border-linefaint px-3.5 py-2.5">
        <div className="truncate text-[13px] font-medium leading-tight">{item.name}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="truncate text-[11px] text-faint">{item.brand || "—"}</span>
          <ColorDots names={item.colors} size={9} />
        </div>
      </div>
    </Link>
  );
}
