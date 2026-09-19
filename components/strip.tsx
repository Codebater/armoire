"use client";

import clsx from "clsx";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useRef } from "react";
import type { Item } from "@/lib/types";
import { IChevronL, IChevronR, ILock } from "./icons";
import { BlobImg } from "./ui";

export function wrapIndex(i: number, n: number): number {
  if (n === 0) return 0;
  return ((i % n) + n) % n;
}

/**
 * One horizontally-swipeable band of the outfit picture.
 * Swipe or use the arrows to cycle through the pieces of this slot.
 */
export function Strip({
  items,
  index,
  onIndex,
  locked,
  onToggleLock,
  label,
  className,
  imgClass,
  emptyHint,
}: {
  items: Item[];
  index: number;
  onIndex: (i: number) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  label: string;
  className?: string;
  imgClass?: string;
  emptyHint?: string;
}) {
  const n = items.length;
  const i = wrapIndex(index, n);
  const item = n ? items[i] : undefined;
  const prev = n > 1 ? items[wrapIndex(i - 1, n)] : undefined;
  const next = n > 1 ? items[wrapIndex(i + 1, n)] : undefined;
  const dirRef = useRef(1);

  const go = (d: number) => {
    if (locked || n < 2) return;
    dirRef.current = d;
    onIndex(index + d);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -52 || info.velocity.x < -420) go(1);
    else if (info.offset.x > 52 || info.velocity.x > 420) go(-1);
  };

  return (
    <div className={clsx("group relative overflow-hidden", className)}>
      {/* slot label */}
      <span className="micro pointer-events-none absolute left-3 top-2.5 z-10 text-faint">
        {label}
        {n > 1 && !locked && <span className="ml-1.5 text-line">{i + 1}/{n}</span>}
      </span>

      {onToggleLock && item && (
        <button
          onClick={onToggleLock}
          aria-label={locked ? "Unlock" : "Lock"}
          className={clsx(
            "absolute right-2.5 top-2 z-10 rounded-full border p-1.5 transition-colors",
            locked ? "border-accent bg-accent text-card" : "border-line bg-card/80 text-faint hover:text-ink",
          )}
        >
          <ILock open={!locked} style={{ width: 13, height: 13 }} />
        </button>
      )}

      {!item ? (
        <div className="grid h-full place-items-center">
          <span className="text-[13px] text-faint">{emptyHint ?? "Nothing here yet"}</span>
        </div>
      ) : (
        <>
          {/* ghost neighbours peeking in */}
          {prev && (
            <div className="pointer-events-none absolute inset-y-[14%] left-0 w-1/3 -translate-x-[62%] opacity-25">
              <BlobImg blob={prev.image} className="h-full w-full object-contain" />
            </div>
          )}
          {next && (
            <div className="pointer-events-none absolute inset-y-[14%] right-0 w-1/3 translate-x-[62%] opacity-25">
              <BlobImg blob={next.image} className="h-full w-full object-contain" />
            </div>
          )}

          <motion.div
            className="flex h-full items-center justify-center px-10"
            drag={locked || n < 2 ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={onDragEnd}
            style={{ touchAction: "pan-y" }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={item.id}
                className="flex h-full w-full items-center justify-center"
                initial={{ x: dirRef.current * 90, opacity: 0, scale: 0.94 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -dirRef.current * 90, opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
              >
                <BlobImg
                  blob={item.image}
                  alt={item.name}
                  className={clsx("max-h-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(27,23,18,0.14)]", imgClass)}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* caption */}
          <span className="pointer-events-none absolute bottom-2 left-3 z-10 max-w-[70%] truncate text-[11px] font-medium text-muted">
            {item.name}
            {item.brand && <span className="text-faint"> · {item.brand}</span>}
          </span>

          {n > 1 && !locked && (
            <>
              <button
                aria-label={`Previous ${label}`}
                onClick={() => go(-1)}
                className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-card/85 p-1.5 text-muted backdrop-blur-sm transition-all hover:text-ink active:scale-90"
              >
                <IChevronL style={{ width: 15, height: 15 }} />
              </button>
              <button
                aria-label={`Next ${label}`}
                onClick={() => go(1)}
                className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-card/85 p-1.5 text-muted backdrop-blur-sm transition-all hover:text-ink active:scale-90"
              >
                <IChevronR style={{ width: 15, height: 15 }} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
