"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { db, logWear, outfitHash, todayISO, uid } from "@/lib/db";
import {
  defaultCtx,
  genLooks,
  scoreLook,
  seasonFor,
  type EngineCtx,
  type Look,
  type ScoredLook,
} from "@/lib/engine";
import { useSetting } from "@/lib/hooks";
import { seedDemo, type SeedProgress } from "@/lib/seed";
import type { City, Item, Occasion, StyleDNA } from "@/lib/types";
import { EMPTY_DNA, OCCASIONS } from "@/lib/types";
import { codeIcon, codeLabel } from "@/lib/weather";
import {
  IBookmark,
  ICheck,
  ICloud,
  IFog,
  IPlus,
  IRain,
  IShuffle,
  ISliders,
  ISnow,
  ISparkle,
  IStorm,
  ISun,
  IX,
} from "./icons";
import { MiniLook } from "./mini-look";
import { SettingsSheet } from "./settings-sheet";
import { Strip, wrapIndex } from "./strip";
import { BlobImg, Chip, ScoreDial, Seg, Sheet, Spinner, useToast } from "./ui";
import { useWeather } from "./use-weather";

const WX_ICON = { sun: ISun, cloud: ICloud, rain: IRain, snow: ISnow, storm: IStorm, fog: IFog };

type Mode = "separates" | "dress";

interface Idx {
  top: number;
  bottom: number;
  dress: number;
  shoes: number;
}

export function Studio() {
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  const items = useLiveQuery(() => db.items.orderBy("createdAt").toArray(), []);
  const wears = useLiveQuery(() => db.wears.toArray(), []);
  const plans = useLiveQuery(() => db.plans.toArray(), []);
  const eventsToday = useLiveQuery(() => db.events.where("date").equals(todayISO()).toArray(), []);
  const [favColors] = useSetting<string[]>("favColors", []);
  const [dna] = useSetting<StyleDNA>("dna", EMPTY_DNA);
  const { weather, city, status: wxStatus } = useWeather();

  const [mode, setMode] = useState<Mode>("separates");
  const [idx, setIdx] = useState<Idx>({ top: 0, bottom: 0, dress: 0, shoes: 0 });
  const [locks, setLocks] = useState({ top: false, bottom: false, dress: false, shoes: false });
  const [outerId, setOuterId] = useState<string | null>(null);
  const [bagId, setBagId] = useState<string | null>(null);
  const [occ, setOcc] = useState<Occasion | undefined>(undefined);
  const [dressSheet, setDressSheet] = useState(false);
  const [layerSheet, setLayerSheet] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generated, setGenerated] = useState<ScoredLook[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [seeding, setSeeding] = useState<SeedProgress | null>(null);

  const pools = useMemo(() => {
    const av = (items ?? []).filter((i) => !i.laundry);
    return {
      tops: av.filter((i) => i.kind === "top"),
      bottoms: av.filter((i) => i.kind === "bottom"),
      dresses: av.filter((i) => i.kind === "dress"),
      shoes: av.filter((i) => i.kind === "shoes"),
      outers: av.filter((i) => i.kind === "outer"),
      bags: av.filter((i) => i.kind === "bag"),
    };
  }, [items]);

  // Auto-pick a sensible mode for the current closet.
  useEffect(() => {
    if (!items) return;
    if (mode === "separates" && (!pools.tops.length || !pools.bottoms.length) && pools.dresses.length) {
      setMode("dress");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /* ------------------------------------------------------------ */
  /* Engine context                                                */
  /* ------------------------------------------------------------ */

  const ctx: EngineCtx = useMemo(() => {
    const base = defaultCtx(todayISO(), seasonFor(new Date(), city?.lat));
    const lastWorn = new Map<string, string>();
    const counts = new Map<string, number>();
    const recent = new Set<string>();
    const today = new Date(todayISO() + "T12:00:00").getTime();
    for (const w of wears ?? []) {
      for (const id of w.itemIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        const prev = lastWorn.get(id);
        if (!prev || prev < w.date) lastWorn.set(id, w.date);
      }
      const age = (today - new Date(w.date + "T12:00:00").getTime()) / 86400000;
      if (age <= 14) recent.add(w.outfitHash);
    }
    for (const p of plans ?? []) recent.add(outfitHash(p.itemIds));
    return {
      ...base,
      occasion: occ ?? eventsToday?.[0]?.occasion,
      weather: weather ? { tempC: weather.now.tempC, precipProb: weather.now.precipProb } : null,
      lastWorn,
      wearCounts: counts,
      recentHashes: recent,
      favColors,
      dna,
    };
  }, [wears, plans, occ, eventsToday, weather, favColors, dna, city?.lat]);

  /* ------------------------------------------------------------ */
  /* Current look                                                  */
  /* ------------------------------------------------------------ */

  const cur: Look = useMemo(() => {
    const all = items ?? [];
    const look: Look = {};
    if (mode === "dress") {
      look.dress = pools.dresses[wrapIndex(idx.dress, pools.dresses.length)];
    } else {
      look.top = pools.tops[wrapIndex(idx.top, pools.tops.length)];
      look.bottom = pools.bottoms[wrapIndex(idx.bottom, pools.bottoms.length)];
    }
    look.shoes = pools.shoes[wrapIndex(idx.shoes, pools.shoes.length)];
    look.outer = outerId ? all.find((i) => i.id === outerId) : undefined;
    look.bag = bagId ? all.find((i) => i.id === bagId) : undefined;
    return look;
  }, [items, pools, idx, mode, outerId, bagId]);

  const curItems = useMemo(
    () => [cur.dress, cur.top, cur.bottom, cur.outer, cur.shoes, cur.bag].filter(Boolean) as Item[],
    [cur],
  );

  const scored = useMemo(() => scoreLook(cur, ctx), [cur, ctx]);

  /* ------------------------------------------------------------ */
  /* Deep links: /?item=… (style this piece) and /?outfit=…        */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    if (!items?.length) return;
    const itemId = sp.get("item");
    const outfitId = sp.get("outfit");
    if (!itemId && !outfitId) return;
    (async () => {
      if (itemId) {
        const it = items.find((i) => i.id === itemId);
        if (it) {
          if (it.kind === "top") {
            setMode("separates");
            setIdx((s) => ({ ...s, top: Math.max(0, pools.tops.findIndex((x) => x.id === it.id)) }));
            setLocks((l) => ({ ...l, top: true }));
          } else if (it.kind === "bottom") {
            setMode("separates");
            setIdx((s) => ({ ...s, bottom: Math.max(0, pools.bottoms.findIndex((x) => x.id === it.id)) }));
            setLocks((l) => ({ ...l, bottom: true }));
          } else if (it.kind === "dress") {
            setMode("dress");
            setIdx((s) => ({ ...s, dress: Math.max(0, pools.dresses.findIndex((x) => x.id === it.id)) }));
            setLocks((l) => ({ ...l, dress: true }));
          } else if (it.kind === "shoes") {
            setIdx((s) => ({ ...s, shoes: Math.max(0, pools.shoes.findIndex((x) => x.id === it.id)) }));
            setLocks((l) => ({ ...l, shoes: true }));
          } else if (it.kind === "outer") setOuterId(it.id);
          else if (it.kind === "bag") setBagId(it.id);
          toast(`Styling around: ${it.name}`);
        }
      }
      if (outfitId) {
        const o = await db.outfits.get(outfitId);
        if (o) applyIds(o.itemIds);
      }
      router.replace("/", { scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sp]);

  function applyIds(ids: string[]) {
    const all = items ?? [];
    const set = ids.map((id) => all.find((i) => i.id === id)).filter(Boolean) as Item[];
    const dress = set.find((i) => i.kind === "dress");
    const top = set.find((i) => i.kind === "top");
    const bottom = set.find((i) => i.kind === "bottom");
    const shoes = set.find((i) => i.kind === "shoes");
    const outer = set.find((i) => i.kind === "outer");
    const bag = set.find((i) => i.kind === "bag");
    if (dress) {
      setMode("dress");
      setIdx((s) => ({ ...s, dress: Math.max(0, pools.dresses.findIndex((x) => x.id === dress.id)), shoes: shoes ? Math.max(0, pools.shoes.findIndex((x) => x.id === shoes.id)) : s.shoes }));
    } else {
      setMode("separates");
      setIdx((s) => ({
        ...s,
        top: top ? Math.max(0, pools.tops.findIndex((x) => x.id === top.id)) : s.top,
        bottom: bottom ? Math.max(0, pools.bottoms.findIndex((x) => x.id === bottom.id)) : s.bottom,
        shoes: shoes ? Math.max(0, pools.shoes.findIndex((x) => x.id === shoes.id)) : s.shoes,
      }));
    }
    setOuterId(outer?.id ?? null);
    setBagId(bag?.id ?? null);
  }

  const applyLook = (l: ScoredLook) => {
    applyIds(l.items.map((i) => i.id));
  };

  /* ------------------------------------------------------------ */
  /* Actions                                                       */
  /* ------------------------------------------------------------ */

  const shuffle = () => {
    if (!items?.length) return;
    const lock: Partial<Look> = {};
    if (mode === "separates") {
      if (locks.top && cur.top) lock.top = cur.top;
      if (locks.bottom && cur.bottom) lock.bottom = cur.bottom;
    } else if (locks.dress && cur.dress) {
      lock.dress = cur.dress;
    }
    if (locks.shoes && cur.shoes) lock.shoes = cur.shoes;
    const res = genLooks(items, ctx, { n: 6, lock, mode: Object.keys(lock).length ? mode : "auto" });
    if (!res.length) {
      toast("Not enough pieces to shuffle");
      return;
    }
    applyLook(res[Math.floor(Math.random() * res.length)]);
  };

  const saveLook = async () => {
    if (curItems.length < 2) return;
    const ids = curItems.map((i) => i.id);
    const hash = outfitHash(ids);
    const dupe = await db.outfits.where("hash").equals(hash).first();
    if (dupe) {
      toast("Already in your looks");
      return;
    }
    await db.outfits.add({
      id: uid(),
      itemIds: ids,
      hash,
      occasion: occ,
      score: scored.score,
      fav: 0,
      createdAt: Date.now(),
    });
    toast("Saved to Looks");
  };

  const wearToday = async () => {
    if (curItems.length < 2) return;
    await logWear(curItems, todayISO(), occ);
    toast("Logged as worn today");
  };

  const dressMe = () => {
    if (!items?.length) return;
    setGenBusy(true);
    setDressSheet(true);
    setTimeout(() => {
      const res = genLooks(items, ctx, { n: 5 });
      setGenerated(res);
      setGenBusy(false);
    }, 30);
  };

  const runSeed = async () => {
    try {
      await seedDemo((p) => setSeeding(p));
      toast("Demo closet curated");
    } catch (e) {
      console.error(e);
      toast("Demo seeding failed");
    } finally {
      setSeeding(null);
    }
  };

  /* ------------------------------------------------------------ */
  /* Render                                                        */
  /* ------------------------------------------------------------ */

  const today = new Date();
  const dateLine = today
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })
    .toUpperCase();

  const WxIcon = weather ? WX_ICON[codeIcon(weather.now.code)] : ISun;

  if (items === undefined) {
    return (
      <div className="mx-auto max-w-md">
        <div className="shimmer h-8 w-40 rounded-full" />
        <div className="shimmer mt-4 aspect-[3/4] rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <div className="card fade-up px-6 py-12 text-center">
          <div className="micro mb-3 text-accent">welcome to armoire</div>
          <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
            Your closet,
            <br />
            <em className="font-light">curated by you.</em>
          </h1>
          <p className="mx-auto mt-3 max-w-[300px] text-sm leading-relaxed text-muted">
            Photograph your pieces, and Armoire will cut them out, tag them and style them into
            outfits — for your weather, your plans, your taste.
          </p>
          {seeding ? (
            <div className="mx-auto mt-7 max-w-[280px]">
              <div className="h-1.5 overflow-hidden rounded-full bg-linefaint">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.round((seeding.done / seeding.total) * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 text-[12px] text-muted">
                <Spinner /> Stitching {seeding.label}…
              </div>
            </div>
          ) : (
            <div className="mt-7 flex flex-col items-center gap-2.5">
              <a href="/add" className="btn-bronze px-7 py-3 text-[14px] font-semibold">
                Add your first pieces
              </a>
              <button onClick={runSeed} className="btn-ghost px-6 py-2.5 text-[13px] font-medium text-soft">
                Or load the demo closet
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const canSeparates = pools.tops.length > 0 && pools.bottoms.length > 0;
  const canDress = pools.dresses.length > 0;

  return (
    <div className="mx-auto max-w-md">
      {/* date + weather */}
      <div className="mb-3 flex items-center justify-between">
        <div className="micro-lg text-muted">{dateLine}</div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-soft transition-colors hover:border-faint"
        >
          {wxStatus === "ok" && weather ? (
            <>
              <WxIcon style={{ width: 14, height: 14 }} className="text-accent" />
              {Math.round(weather.now.tempC)}° {city?.name ?? "Here"}
              <span className="text-faint">· {codeLabel(weather.now.code)}</span>
            </>
          ) : wxStatus === "loading" ? (
            <>
              <Spinner /> weather…
            </>
          ) : (
            <>
              <ISliders style={{ width: 14, height: 14 }} /> Set city
            </>
          )}
        </button>
      </div>

      {/* occasion + mode */}
      <div className="mb-3 flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          <Chip active={!occ} onClick={() => setOcc(undefined)}>
            Anything
          </Chip>
          {OCCASIONS.map((o) => (
            <Chip key={o} active={occ === o} onClick={() => setOcc(occ === o ? undefined : o)}>
              {o}
            </Chip>
          ))}
        </div>
      </div>

      {eventsToday && eventsToday.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-champagne/60 bg-card px-3.5 py-2 text-[12.5px] text-soft">
          <ISparkle className="text-accent" style={{ width: 14, height: 14 }} />
          Today: <strong className="font-semibold">{eventsToday[0].title}</strong>
          <span className="text-faint">· {eventsToday[0].occasion}</span>
        </div>
      )}

      {/* THE PICTURE — swipe each band */}
      <div className="card relative overflow-hidden">
        {canDress && canSeparates && (
          <div className="absolute right-3 top-3 z-20">
            <Seg
              options={[
                { value: "separates" as Mode, label: "Mix" },
                { value: "dress" as Mode, label: "Dress" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        )}
        <div className="aspect-[3/4]">
          <div className="flex h-full flex-col pt-2">
            {mode === "dress" ? (
              <Strip
                items={pools.dresses}
                index={idx.dress}
                onIndex={(i) => setIdx((s) => ({ ...s, dress: i }))}
                locked={locks.dress}
                onToggleLock={() => setLocks((l) => ({ ...l, dress: !l.dress }))}
                label="dress"
                className="h-[80%]"
                emptyHint="No dresses yet"
              />
            ) : (
              <>
                <Strip
                  items={pools.tops}
                  index={idx.top}
                  onIndex={(i) => setIdx((s) => ({ ...s, top: i }))}
                  locked={locks.top}
                  onToggleLock={() => setLocks((l) => ({ ...l, top: !l.top }))}
                  label="top"
                  className="h-[41%]"
                  emptyHint="Add tops to begin"
                />
                <Strip
                  items={pools.bottoms}
                  index={idx.bottom}
                  onIndex={(i) => setIdx((s) => ({ ...s, bottom: i }))}
                  locked={locks.bottom}
                  onToggleLock={() => setLocks((l) => ({ ...l, bottom: !l.bottom }))}
                  label="bottom"
                  className="h-[39%]"
                  emptyHint="Add bottoms to begin"
                />
              </>
            )}
            <Strip
              items={pools.shoes}
              index={idx.shoes}
              onIndex={(i) => setIdx((s) => ({ ...s, shoes: i }))}
              locked={locks.shoes}
              onToggleLock={() => setLocks((l) => ({ ...l, shoes: !l.shoes }))}
              label="shoes"
              className="h-[20%]"
              imgClass="max-h-[86%]"
              emptyHint="Add shoes"
            />
          </div>
        </div>
      </div>

      {/* score + actions */}
      <div className="mt-4 flex items-center gap-3">
        <ScoreDial value={scored.score} />
        <div className="min-w-0 flex-1">
          <div className="micro mb-1 text-faint">match</div>
          <div className="flex flex-wrap gap-1">
            {scored.reasons.length ? (
              scored.reasons.map((r) => (
                <span key={r} className="rounded-full bg-linefaint px-2.5 py-1 text-[11px] font-medium text-soft">
                  {r}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-faint">a quiet, clean combination</span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={shuffle} aria-label="Shuffle" className="btn-ghost grid h-10 w-10 place-items-center text-soft">
            <IShuffle style={{ width: 17, height: 17 }} />
          </button>
          <button onClick={saveLook} aria-label="Save look" className="btn-ghost grid h-10 w-10 place-items-center text-soft">
            <IBookmark style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={wearToday} aria-label="Wear today" className="btn-ghost grid h-10 w-10 place-items-center text-soft">
            <ICheck style={{ width: 17, height: 17 }} />
          </button>
        </div>
      </div>

      {/* layers & bags */}
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
        {cur.outer ? (
          <LayerChip item={cur.outer} onClear={() => setOuterId(null)} label="layer" />
        ) : (
          <button onClick={() => setLayerSheet(true)} className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-muted">
            <IPlus style={{ width: 13, height: 13 }} /> Layer
          </button>
        )}
        {cur.bag ? (
          <LayerChip item={cur.bag} onClear={() => setBagId(null)} label="bag" />
        ) : (
          <button onClick={() => setLayerSheet(true)} className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-muted">
            <IPlus style={{ width: 13, height: 13 }} /> Bag
          </button>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-faint">{curItems.length} pieces</span>
      </div>

      {/* dress me */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={dressMe}
        className="btn-bronze mt-5 flex w-full items-center justify-center gap-2 py-4 text-[15px] font-semibold tracking-wide"
      >
        <ISparkle style={{ width: 18, height: 18 }} />
        Dress me today
      </motion.button>

      {/* sheets */}
      <Sheet open={dressSheet} onClose={() => setDressSheet(false)} title="Today's proposals">
        <div className="mb-3 text-[12.5px] text-muted">
          {weather
            ? `${Math.round(weather.now.tempC)}° ${codeLabel(weather.now.code).toLowerCase()}, rain ${weather.now.precipProb}%`
            : "no weather set"}
          {ctx.occasion ? ` · dressed for ${ctx.occasion}` : ""}
          {eventsToday?.length ? ` · ${eventsToday[0].title}` : ""}
        </div>
        {genBusy ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted">
            <Spinner /> composing looks…
          </div>
        ) : generated.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            Not enough available pieces — add more or empty the laundry basket.
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {generated.map((l, gi) => (
                <motion.button
                  key={l.hash}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06, type: "spring", stiffness: 300, damping: 26 }}
                  onClick={() => {
                    applyLook(l);
                    setDressSheet(false);
                    toast("Styled — swipe any band to tweak");
                  }}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-champagne"
                >
                  <MiniLook parts={l} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl">{l.score}</span>
                      <span className="micro text-faint">match</span>
                    </div>
                    <div className="mt-1 truncate text-[12px] text-muted">
                      {l.reasons.join(" · ") || "clean and quiet"}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-faint">
                      {l.items.map((i) => i.name).join(" + ")}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Sheet>

      <Sheet open={layerSheet} onClose={() => setLayerSheet(false)} title="Layers & bags">
        <PickRow
          label="Layer"
          items={pools.outers}
          activeId={outerId}
          onPick={(id) => setOuterId(id)}
        />
        <div className="h-4" />
        <PickRow label="Bag" items={pools.bags} activeId={bagId} onPick={(id) => setBagId(id)} />
      </Sheet>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function LayerChip({ item, onClear, label }: { item: Item; onClear: () => void; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-2.5">
      <span className="h-8 w-8 overflow-hidden rounded-full border border-linefaint bg-surface">
        <BlobImg blob={item.thumb} className="h-full w-full object-contain" />
      </span>
      <span className="text-[12px] font-medium text-soft">
        <span className="micro mr-1 text-faint">{label}</span>
        {item.name}
      </span>
      <button onClick={onClear} aria-label={`Remove ${label}`} className="text-faint hover:text-ink">
        <IX style={{ width: 12, height: 12 }} />
      </button>
    </span>
  );
}

function PickRow({
  label,
  items,
  activeId,
  onPick,
}: {
  label: string;
  items: Item[];
  activeId: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div>
      <div className="micro mb-2 text-muted">{label}</div>
      {items.length === 0 ? (
        <div className="text-[13px] text-faint">Nothing in this drawer yet.</div>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onPick(null)}
            className={`grid h-20 w-16 shrink-0 place-items-center rounded-xl border text-[11px] font-medium ${activeId === null ? "border-ink bg-ink text-card" : "border-line bg-card text-muted"}`}
          >
            None
          </button>
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => onPick(activeId === i.id ? null : i.id)}
              className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl border p-1 ${activeId === i.id ? "border-accent bg-card shadow-soft" : "border-line bg-card"}`}
              title={i.name}
            >
              <BlobImg blob={i.thumb} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
