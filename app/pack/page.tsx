"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IChevronL, ISuitcase } from "@/components/icons";
import { MiniLook } from "@/components/mini-look";
import { BlobImg, Chip, Field, PageHead, Spinner, inputCls, useToast } from "@/components/ui";
import { db, toISODate, todayISO } from "@/lib/db";
import { defaultCtx, packForTrip, seasonFor, wearMaps, type PackingResult } from "@/lib/engine";
import { dayName, fmtDateShort } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import type { City, Occasion } from "@/lib/types";
import { KIND_LABEL, OCCASIONS } from "@/lib/types";
import { fetchWeather, geocodeCity } from "@/lib/weather";

export default function PackPage() {
  const toast = useToast();
  const items = useLiveQuery(() => db.items.toArray(), []);
  const wears = useLiveQuery(() => db.wears.toArray(), []);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [results, setResults] = useState<City[]>([]);
  const [dest, setDest] = useState<City | null>(null);
  const [start, setStart] = useState(() => toISODate(new Date(Date.now() + 7 * 86400000)));
  const [nights, setNights] = useState(4);
  const [occs, setOccs] = useState<Occasion[]>(["casual", "dinner"]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PackingResult | null>(null);
  const [tripTemp, setTripTemp] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (dq.trim().length < 2) return setResults([]);
    let cancel = false;
    geocodeCity(dq)
      .then((r) => !cancel && setResults(r))
      .catch(() => !cancel && setResults([]));
    return () => {
      cancel = true;
    };
  }, [dq]);

  const dates = useMemo(() => {
    const out: string[] = [];
    const base = new Date(start + "T12:00:00");
    for (let d = 0; d < Math.max(1, nights); d++) out.push(toISODate(new Date(base.getTime() + d * 86400000)));
    return out;
  }, [start, nights]);

  const generate = async () => {
    if (!items?.length) return;
    setBusy(true);
    setResult(null);
    let tempC: number | null = null;
    try {
      if (dest) {
        const w = await fetchWeather(dest.lat, dest.lon);
        const inRange = w.days.filter((d) => dates.includes(d.date));
        if (inRange.length) {
          tempC = inRange.reduce((s, d) => s + (d.tempMaxC + d.tempMinC) / 2, 0) / inRange.length;
        } else {
          tempC = (w.days.reduce((s, d) => s + (d.tempMaxC + d.tempMinC) / 2, 0) / w.days.length);
        }
      }
    } catch {
      /* pack without weather */
    }
    setTripTemp(tempC);
    setTimeout(() => {
      const ctx = {
        ...defaultCtx(todayISO(), seasonFor(new Date(start + "T12:00:00"), dest?.lat)),
        ...wearMaps(wears ?? [], todayISO()),
      };
      const r = packForTrip(items, ctx, dates, occs, tempC);
      setResult(r);
      setChecked(new Set());
      setBusy(false);
      if (!r) toast("Not enough pieces for a plan — add more first");
    }, 30);
  };

  const copyList = async () => {
    if (!result) return;
    const lines: string[] = [`ARMOIRE packing — ${dest ? dest.name + ", " : ""}${fmtDateShort(dates[0])} · ${nights} days`, ""];
    for (const [kind, arr] of result.byKind) {
      lines.push(KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind);
      for (const i of arr) lines.push(`  □ ${i.name}${i.brand ? ` (${i.brand})` : ""}`);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    toast("List copied");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/insights" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <IChevronL style={{ width: 15, height: 15 }} /> Insights
      </Link>
      <PageHead kicker="travel light" title="Packing list" />

      <div className="card space-y-4 p-5">
        <Field label="Destination">
          <input
            className={inputCls}
            placeholder={dest ? `${dest.name}${dest.country ? ", " + dest.country : ""}` : "Where to?"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
              {results.map((r, i) => (
                <button
                  key={`${r.name}-${i}`}
                  className="block w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-linefaint"
                  onClick={() => {
                    setDest(r);
                    setQ("");
                    setResults([]);
                  }}
                >
                  {r.name}
                  <span className="text-muted"> · {r.country}</span>
                </button>
              ))}
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First day">
            <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Days">
            <input
              type="number"
              min={1}
              max={14}
              className={inputCls}
              value={nights}
              onChange={(e) => setNights(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
            />
          </Field>
        </div>
        <div>
          <span className="micro mb-1.5 block text-muted">What's on the agenda?</span>
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => (
              <Chip key={o} active={occs.includes(o)} onClick={() => setOccs((cs) => (cs.includes(o) ? cs.filter((x) => x !== o) : [...cs, o]))}>
                {o}
              </Chip>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={busy || !items?.length} className="btn-bronze flex w-full items-center justify-center gap-2 py-3.5 text-[14px] font-semibold disabled:opacity-60">
          {busy ? <Spinner className="border-card/40 border-t-card" /> : <ISuitcase style={{ width: 17, height: 17 }} />}
          Pack my case
        </button>
      </div>

      {result && (
        <div className="fade-up mt-5 space-y-4">
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-display text-3xl">{result.items.length}</span>
                <span className="ml-2 text-[13px] text-muted">
                  pieces → {result.days.length} outfits
                  {tripTemp !== null ? ` · around ${Math.round(tripTemp)}°` : ""}
                  {dest ? ` in ${dest.name}` : ""}
                </span>
              </div>
              <button onClick={copyList} className="btn-ghost px-4 py-2 text-[12px] font-semibold">
                Copy list
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="micro mb-3 text-muted">day by day</div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {result.days.map(({ date, look }) => (
                <div key={date} className="w-24 shrink-0 text-center">
                  <div className="micro mb-1 text-faint">{dayName(date)}</div>
                  <MiniLook parts={look} className="h-28 w-24" />
                  <div className="mt-1 text-[10px] text-muted">match {look.score}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="micro mb-3 text-muted">the checklist</div>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {result.byKind.map(([kind, arr]) => (
                <div key={kind}>
                  <div className="micro mb-2 text-accent">{KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind}</div>
                  {arr.map((i) => {
                    const done = checked.has(i.id);
                    return (
                      <button
                        key={i.id}
                        onClick={() =>
                          setChecked((c) => {
                            const n = new Set(c);
                            if (n.has(i.id)) n.delete(i.id);
                            else n.add(i.id);
                            return n;
                          })
                        }
                        className="flex w-full items-center gap-2.5 border-b border-linefaint py-1.5 text-left last:border-b-0"
                      >
                        <span className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded border text-[9px] ${done ? "border-accent bg-accent text-card" : "border-line"}`} style={{ width: 18, height: 18 }}>
                          {done ? "✓" : ""}
                        </span>
                        <span className="h-8 w-8 shrink-0 rounded-md border border-linefaint bg-card p-0.5">
                          <BlobImg blob={i.thumb} className="h-full w-full object-contain" />
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${done ? "text-faint line-through" : "font-medium"}`}>
                          {i.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
