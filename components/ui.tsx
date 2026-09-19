"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { colorHex } from "@/lib/colors";
import { useBlobUrl } from "@/lib/hooks";

/* ---------------------------------------------------------------- */
/* Blob image                                                        */
/* ---------------------------------------------------------------- */

export function BlobImg({
  blob,
  alt = "",
  className,
}: {
  blob?: Blob | null;
  alt?: string;
  className?: string;
}) {
  const url = useBlobUrl(blob);
  if (!url) return <div className={clsx("shimmer rounded-lg", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} draggable={false} className={clsx("select-none", className)} />;
}

/* ---------------------------------------------------------------- */
/* Toasts                                                            */
/* ---------------------------------------------------------------- */

interface Toast {
  id: number;
  msg: string;
}

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((msg: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="rounded-full border border-line bg-ink px-4 py-2 text-[13px] font-medium text-card shadow-lift"
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- */
/* Bottom sheet                                                      */
/* ---------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={clsx(
              "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-lift",
              wide ? "max-w-2xl" : "max-w-md",
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl">{title}</h3>
                <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
                  <XIcon />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Small primitives                                                  */
/* ---------------------------------------------------------------- */

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-ink bg-ink text-card"
          : "border-line bg-card text-soft hover:border-faint",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="relative rounded-full px-4 py-1.5 text-[12.5px] font-medium"
        >
          {value === o.value && (
            <motion.span
              layoutId="seg-pill"
              className="absolute inset-0 rounded-full bg-ink"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className={clsx("relative z-10", value === o.value ? "text-card" : "text-muted")}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ColorDots({ names, size = 12 }: { names: string[]; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {names.map((n) => (
        <span
          key={n}
          title={n}
          className="inline-block rounded-full border border-ink/15"
          style={{ width: size, height: size, background: colorHex(n) }}
        />
      ))}
    </span>
  );
}

export function ScoreDial({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={3} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-lg leading-none">{Math.round(value)}</span>
      </div>
    </div>
  );
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("micro text-accent", className)}>{children}</div>;
}

export function PageHead({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <Kicker className="mb-1.5">{kicker}</Kicker>
        <h1 className="font-display text-[28px] leading-none tracking-tight md:text-4xl">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card fade-up mx-auto max-w-md px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-line text-accent">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 6.6a2.1 2.1 0 1 0-2.1-2.1M12 6.6v1.9M12 8.5 3.6 14.9a1.3 1.3 0 0 0 .8 2.3h15.2a1.3 1.3 0 0 0 .8-2.3L12 8.5Z" />
        </svg>
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{body}</p>}
      {children && <div className="mt-5 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent align-middle",
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="micro mb-1.5 block text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-[14px] placeholder:text-faint";
