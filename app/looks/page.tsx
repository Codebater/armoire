"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ICalendar,
  ICheck,
  ICloud,
  IFog,
  IHeart,
  IPlus,
  IRain,
  ISnow,
  ISparkle,
  IStorm,
  ISun,
  ITrash,
  IX,
} from "@/components/icons";
import { MiniLook, partsFromItems } from "@/components/mini-look";
import { Chip, EmptyState, Field, PageHead, Seg, Sheet, Spinner, inputCls, useToast } from "@/components/ui";
import { useWeather } from "@/components/use-weather";
import { db, logWear, outfitHash, toISODate, todayISO, uid } from "@/lib/db";
import { defaultCtx, genLooks, seasonFor, wearMaps, type EngineCtx, type ScoredLook } from "@/lib/engine";
import { dayName, fmtDateShort } from "@/lib/format";
import { useSetting } from "@/lib/hooks";
import type { EventRec, Item, Occasion, StyleDNA } from "@/lib/types";
import { EMPTY_DNA, OCCASIONS } from "@/lib/types";
import { codeIcon } from "@/lib/weather";

const WX_ICON = { sun: ISun, cloud: ICloud, rain: IRain, snow: ISnow, storm: IStorm, fog: IFog };

type Tab = "saved" | "planner" | "history";

export default function LooksPage() {
  const [tab, setTab] = useState<Tab>("saved");
  return (
    <div>
      <PageHead
        kicker="the lookbook"
        title="Looks"
        right={
          <Seg
            options={[
              { value: "saved" as Tab, label: "Saved" },
              { value: "planner" as Tab, label: "Week" },
              { value: "history" as Tab, label: "Worn" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />
      {tab === "saved" && <SavedTab />}
      {tab === "planner" && <PlannerTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

function useItemMap() {
  const items = useLiveQuery(() => db.items.toArray(), []);
  return {
    items,
    byId: useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]),
  };
}

/* ---------------------------------------------------------------- */
/* Saved looks                                                       */
/* ---------------------------------------------------------------- */

function SavedTab() {
  const toast = useToast();
  const outfits = useLiveQuery(() => db.outfits.orderBy("createdAt").reverse().toArray(), []);
  const { byId } = useItemMap();

  if (outfits === undefined) return <div className="shimmer h-60 rounded-2xl" />;
  if (outfits.length === 0)
    return (
      <EmptyState title="No saved looks yet" body="Compose something in the Studio and tap the bookmark — it will live here.">
        <Link href="/" className="btn-bronze px-6 py-2.5 text-[13.5px] font-semibold">
          Open Studio
        </Link>
      </EmptyState>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map((o) => {
        const its = o.itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[];
        return (
          <div key={o.id} className="card flex gap-4 p-4">
            <Link href={`/?outfit=${o.id}`}>
              <MiniLook parts={partsFromItems(its)} className="h-28 w-24" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-lg leading-tight">
                  {o.name ?? its.map((i) => i.name.split(" ")[0]).slice(0, 2).join(" × ")}
                </span>
                <button
                  onClick={() => db.outfits.update(o.id, { fav: o.fav ? 0 : 1 })}
                  className={o.fav ? "text-clay" : "text-faint hover:text-clay"}
                  aria-label="Favourite"
                >
                  <IHeart filled={o.fav === 1} style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <div className="mt-0.5 text-[11.5px] text-faint">
                {o.occasion ?? "any occasion"}
                {o.score ? ` · match ${o.score}` : ""}
              </div>
              <div className="mt-1 truncate text-[11.5px] text-muted">{its.map((i) => i.name).join(" + ")}</div>
              <div className="mt-2.5 flex gap-1.5">
                <button
                  onClick={async () => {
                    await logWear(its, todayISO(), o.occasion);
                    toast("Logged as worn today");
                  }}
                  className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-[11.5px] font-semibold"
                >
                  <ICheck style={{ width: 12, height: 12 }} /> Wear
                </button>
                <Link href={`/?outfit=${o.id}`} className="btn-ghost px-3 py-1.5 text-[11.5px] font-semibold">
                  Open
                </Link>
                <button
                  onClick={() => db.outfits.delete(o.id)}
                  className="ml-auto flex items-center gap-1 text-[11px] text-faint hover:text-clay"
                >
                  <ITrash style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Week planner                                                      */
/* ---------------------------------------------------------------- */

function PlannerTab() {
  const toast = useToast();
  const { items, byId } = useItemMap();
  const wears = useLiveQuery(() => db.wears.toArray(), []);
  const plans = useLiveQuery(() => db.plans.toArray(), []);
  const events = useLiveQuery(() => db.events.toArray(), []);
  const outfits = useLiveQuery(() => db.outfits.toArray(), []);
  const { weather, city } = useWeather();
  const [favColors] = useSetting<string[]>("favColors", []);
  const [dna] = useSetting<StyleDNA>("dna", EMPTY_DNA);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [dayGen, setDayGen] = useState<ScoredLook[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [eventSheet, setEventSheet] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(todayISO());
  const [evOcc, setEvOcc] = useState<Occasion>("dinner");
  const [planning, setPlanning] = useState(false);

  const days = useMemo(() => {
    const out: string[] = [];
    const base = new Date();
    for (let d = 0; d < 7; d++) out.push(toISODate(new Date(base.getTime() + d * 86400000)));
    return out;
  }, []);

  const planByDate = useMemo(() => new Map((plans ?? []).map((p) => [p.date, p])), [plans]);
  const eventsByDate = useMemo(() => {
    const m = new Map<string, EventRec[]>();
    for (const e of events ?? []) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);
  const wxByDate = useMemo(() => new Map((weather?.days ?? []).map((d) => [d.date, d])), [weather]);

  const baseCtx = (date: string): EngineCtx => {
    const maps = wearMaps(wears ?? [], todayISO());
    const wx = wxByDate.get(date);
    const ev = eventsByDate.get(date)?.[0];
    return {
      ...defaultCtx(date, seasonFor(new Date(date + "T12:00:00"), city?.lat ?? undefined)),
      ...maps,
      weather: wx ? { tempC: (wx.tempMaxC + wx.tempMinC) / 2, precipProb: wx.precipProb } : null,
      occasion: ev?.occasion,
      favColors,
      dna,
    };
  };

  const generateForDay = (date: string) => {
    if (!items?.length) return;
    setGenBusy(true);
    setTimeout(() => {
      setDayGen(genLooks(items, baseCtx(date), { n: 3 }));
      setGenBusy(false);
    }, 30);
  };

  const assign = async (date: string, itemIds: string[]) => {
    const existing = planByDate.get(date);
    if (existing) await db.plans.update(existing.id, { itemIds });
    else await db.plans.add({ id: uid(), date, itemIds });
    setAssignFor(null);
    toast(`Planned for ${dayName(date, "long")}`);
  };

  const autoPlan = async () => {
    if (!items?.length) return;
    setPlanning(true);
    setTimeout(async () => {
      const maps = wearMaps(wears ?? [], todayISO());
      const usedHashes = new Set(maps.recentHashes);
      const lastWorn = new Map(maps.lastWorn);
      let planned = 0;
      for (const date of days) {
        if (planByDate.get(date)) continue;
        const wx = wxByDate.get(date);
        const ev = eventsByDate.get(date)?.[0];
        const ctx: EngineCtx = {
          ...defaultCtx(date, seasonFor(new Date(date + "T12:00:00"), city?.lat ?? undefined)),
          lastWorn,
          wearCounts: maps.wearCounts,
          recentHashes: usedHashes,
          weather: wx ? { tempC: (wx.tempMaxC + wx.tempMinC) / 2, precipProb: wx.precipProb } : null,
          occasion: ev?.occasion,
          favColors,
          dna,
        };
        const [look] = genLooks(items, ctx, { n: 1 });
        if (!look) continue;
        await db.plans.add({ id: uid(), date, itemIds: look.items.map((i) => i.id) });
        usedHashes.add(look.hash);
        for (const i of look.items) lastWorn.set(i.id, date);
        planned++;
      }
      setPlanning(false);
      toast(planned ? `Planned ${planned} days` : "Week already planned");
    }, 30);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">A week of outfits, matched to forecast and calendar.</p>
        <div className="flex gap-2">
          <button onClick={() => setEventSheet(true)} className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            <ICalendar style={{ width: 14, height: 14 }} /> Event
          </button>
          <button onClick={autoPlan} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            {planning ? <Spinner className="border-card/40 border-t-card" /> : <ISparkle style={{ width: 14, height: 14 }} />}
            Plan my week
          </button>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0 lg:grid-cols-7">
        {days.map((date) => {
          const plan = planByDate.get(date);
          const its = (plan?.itemIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Item[];
          const wx = wxByDate.get(date);
          const evs = eventsByDate.get(date) ?? [];
          const Icon = wx ? WX_ICON[codeIcon(wx.code)] : null;
          const isToday = date === todayISO();
          return (
            <div key={date} className={`card w-40 shrink-0 p-3 md:w-auto ${isToday ? "border-champagne" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`micro ${isToday ? "text-accent" : "text-faint"}`}>{isToday ? "today" : dayName(date)}</div>
                  <div className="text-[13px] font-semibold">{fmtDateShort(date)}</div>
                </div>
                {wx && Icon && (
                  <div className="text-right text-[11px] text-muted">
                    <Icon className="ml-auto text-accent" style={{ width: 15, height: 15 }} />
                    {Math.round(wx.tempMaxC)}°/{Math.round(wx.tempMinC)}°
                  </div>
                )}
              </div>
              {evs.map((e) => (
                <div key={e.id} className="mt-2 flex items-center justify-between gap-1 rounded-lg bg-linefaint px-2 py-1 text-[10.5px] font-medium text-soft">
                  <span className="truncate">{e.title}</span>
                  <button onClick={() => db.events.delete(e.id)} className="text-faint hover:text-clay" aria-label="Delete event">
                    <IX style={{ width: 10, height: 10 }} />
                  </button>
                </div>
              ))}
              <div className="mt-2.5">
                {its.length ? (
                  <div className="relative">
                    <MiniLook parts={partsFromItems(its)} className="h-28 w-full" />
                    <div className="mt-1.5 flex justify-between">
                      <button onClick={() => { setAssignFor(date); generateForDay(date); }} className="text-[11px] font-medium text-muted underline-offset-2 hover:underline">
                        change
                      </button>
                      <div className="flex gap-2">
                        {isToday && (
                          <button
                            onClick={async () => {
                              await logWear(its, date);
                              toast("Worn — enjoy it");
                            }}
                            className="text-[11px] font-semibold text-sage"
                          >
                            worn ✓
                          </button>
                        )}
                        <button onClick={() => plan && db.plans.delete(plan.id)} className="text-[11px] text-faint hover:text-clay">
                          clear
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAssignFor(date);
                      generateForDay(date);
                    }}
                    className="grid h-28 w-full place-items-center rounded-xl border border-dashed border-line text-faint transition-colors hover:border-champagne hover:text-accent"
                  >
                    <span className="flex flex-col items-center gap-1 text-[11px] font-medium">
                      <IPlus style={{ width: 16, height: 16 }} /> plan
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* assign sheet */}
      <Sheet open={assignFor !== null} onClose={() => setAssignFor(null)} title={assignFor ? `${dayName(assignFor, "long")} ${fmtDateShort(assignFor)}` : ""}>
        {assignFor && (
          <div className="space-y-5">
            <div>
              <div className="micro mb-2 text-muted">fresh proposals</div>
              {genBusy ? (
                <div className="flex items-center gap-2 py-6 text-muted">
                  <Spinner /> composing…
                </div>
              ) : (
                <div className="space-y-2">
                  {dayGen.map((l) => (
                    <button
                      key={l.hash}
                      onClick={() => assign(assignFor, l.items.map((i) => i.id))}
                      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left hover:border-champagne"
                    >
                      <MiniLook parts={l} />
                      <div className="min-w-0">
                        <span className="font-display text-xl">{l.score}</span>
                        <div className="truncate text-[11.5px] text-muted">{l.items.map((i) => i.name).join(" + ")}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(outfits ?? []).length > 0 && (
              <div>
                <div className="micro mb-2 text-muted">or a saved look</div>
                <div className="no-scrollbar flex gap-2 overflow-x-auto">
                  {(outfits ?? []).map((o) => (
                    <button key={o.id} onClick={() => assign(assignFor, o.itemIds)} title={o.name}>
                      <MiniLook parts={partsFromItems(o.itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[])} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* event sheet */}
      <Sheet open={eventSheet} onClose={() => setEventSheet(false)} title="Add event">
        <div className="space-y-4">
          <Field label="Title">
            <input className={inputCls} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Dinner with L." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className={inputCls} value={evDate} onChange={(e) => setEvDate(e.target.value)} />
            </Field>
            <Field label="Occasion">
              <select className={inputCls} value={evOcc} onChange={(e) => setEvOcc(e.target.value as Occasion)}>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            onClick={async () => {
              if (!evTitle.trim()) return;
              await db.events.add({ id: uid(), date: evDate, title: evTitle.trim(), occasion: evOcc });
              setEventSheet(false);
              setEvTitle("");
              toast("Event added");
            }}
            className="btn-primary w-full py-3 text-[14px] font-semibold"
          >
            Add event
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* History                                                           */
/* ---------------------------------------------------------------- */

function HistoryTab() {
  const wears = useLiveQuery(() => db.wears.orderBy("date").reverse().toArray(), []);
  const { byId } = useItemMap();

  if (wears === undefined) return <div className="shimmer h-60 rounded-2xl" />;
  if (wears.length === 0)
    return <EmptyState title="No wears logged" body="Tap the ✓ in the Studio when you wear a look — history, stats and smarter rotation all flow from it." />;

  const groups = new Map<string, typeof wears>();
  for (const w of wears) {
    const arr = groups.get(w.date) ?? [];
    arr.push(w);
    groups.set(w.date, arr);
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([date, ws]) => (
        <div key={date} className="card p-4">
          <div className="mb-2.5 flex items-baseline gap-2">
            <span className="font-display text-lg">{dayName(date, "long")}</span>
            <span className="text-[12px] text-faint">{fmtDateShort(date)}</span>
          </div>
          {ws.map((w) => {
            const its = w.itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[];
            return (
              <div key={w.id} className="flex items-center gap-3 border-t border-linefaint py-2.5 first:border-t-0">
                <MiniLook parts={partsFromItems(its)} className="h-20 w-16" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {its.length ? its.map((i) => i.name).join(" + ") : "pieces since removed"}
                  </div>
                  <div className="text-[11.5px] text-faint">{w.occasion ?? "unspecified"}</div>
                </div>
                <button onClick={() => db.wears.delete(w.id)} className="text-faint hover:text-clay" aria-label="Delete">
                  <ITrash style={{ width: 14, height: 14 }} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
