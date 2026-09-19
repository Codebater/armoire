"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

/** Stable object URL for a Blob, revoked on change/unmount. */
export function useBlobUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Live setting value + setter. */
export function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return row ? (row.value as T) : fallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    void db.settings.put({ key, value: v });
  };
  return [value === undefined ? fallback : value, set];
}

/** True once mounted on the client (avoids SSR/live-query flashes). */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Debounced value. */
export function useDebounced<T>(value: T, ms = 220): T {
  const [v, setV] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setV(value), ms);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [value, ms]);
  return v;
}
