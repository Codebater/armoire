"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ISliders, ISparkle, ISuitcase } from "@/components/icons";
import { SettingsSheet } from "@/components/settings-sheet";
import { BlobImg, PageHead, useToast } from "@/components/ui";
import { colorHex } from "@/lib/colors";
import { db, todayISO, uid } from "@/lib/db";
import { defaultCtx, gapSuggestions, seasonFor, versatilityMap, wearMaps } from "@/lib/engine";
import { fmtMoney, plural, relDays } from "@/lib/format";
import { useSetting } from "@/lib/hooks";
import type { City, Item, Season, StyleDNA } from "@/lib/types";
import { EMPTY_DNA, SEASONS } from "@/lib/types";

export default function InsightsPage() {
  const toast = useToast();
  const items = useLiveQuery(() => db.items.toArray(), []);
  const wears = useLiveQuery(() => db.wears.toArray(), []);
  const outfits = useLiveQuery(() => db.outfits.toArray(), []);
  const [dna] = useSetting<StyleDNA>("dna", EMPTY_DNA);
  const [city] = useSetting<City | null>("city", null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const ctx = useMemo(() => {
    const base = defaultCtx(todayISO(), seasonFor(new Date(), city?.lat ?? undefined));
    return { ...base, ...wearMaps(wears ?? [], todayISO()) };
  }, [wears, city?.lat]);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  const stats = useMemo(() => {
    if (!items || !wears) return null;
    const counts = ctx.wearCounts;
    const withCounts = items.map((i) => ({ item: i, count: counts.get(i.id) ?? 0 }));
    const mostWorn = [...withCounts].sort((a, b) => b.count - a.count).filter((x) => x.count > 0).slice(0, 5);
    const neglected = [...withCounts]
      .filter((x) => x.count === 0 || !ctx.lastWorn.get(x.item.id))
      .slice(0, 8);
    const lightlyWorn = [...withCounts]
      .filter((x) => x.count > 0)
      .sort((a, b) => a.count - b.count)
      .slice(0, 8 - neglected.length);
    const cpw = withCounts
      .filter((x) => x.item.price !== undefined && x.count > 0)
      .map((x) => ({ ...x, cpw: (x.item.price ?? 0) / x.count }));
    const bestCpw = [...cpw].sort((a, b) => a.cpw - b.cpw).slice(0, 3);
    const worstCpw = [...cpw].sort((a, b) => b.cpw - a.cpw).slice(0, 3);

    // colour share: closet vs actually worn
    const closetColors = new Map<string, number>();
    const wornColors = new Map<string, number>();
    for (const { item, count } of withCounts) {
      const c = item.colors[0];
      if (!c) continue;
      closetColors.set(c, (closetColors.get(c) ?? 0) + 1);
      if (count > 0) wornColors.set(c, (wornColors.get(c) ?? 0) + count);
    }
    const seasonUse = new Map<Season, number>();
    for (const w of wears) {
      for (const id of w.itemIds) {
        const it = byId.get(id);
        if (!it) continue;
        for (const s of it.seasons) seasonUse.set(s, (seasonUse.get(s) ?? 0) + 1 / it.seasons.length);
      }
    }
    const value = items.reduce((s, i) => s + (i.price ?? 0), 0);
    const outfitFreq = new Map<string, number>();
    for (const w of wears) outfitFreq.set(w.outfitHash, (outfitFreq.get(w.outfitHash) ?? 0) + 1);
    const repeatLook = [...outfitFreq.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      mostWorn,
      neglected: [...neglected, ...lightlyWorn].slice(0, 6),
      bestCpw,
      worstCpw,
      closetColors,
      wornColors,
      seasonUse,
      value,
      repeatLook,
      totalWears: wears.length,
    };
  }, [items, wears, ctx, byId]);

  const versatile = useMemo(() => {
    if (!items?.length) return [];
    const v = versatilityMap(items, ctx);
    return [...v.entries()]
      .map(([id, n]) => ({ item: byId.get(id)!, n }))
      .filter((x) => x.item && ["top", "bottom", "dress", "shoes", "outer"].includes(x.item.kind))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
  }, [items, ctx, byId]);

  const gaps = useMemo(() => (items?.length ? gapSuggestions(items, ctx) : []), [items, ctx]);

  const dnaTop = useMemo(() => {
    const styles = Object.entries(dna.styles).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = styles[0]?.[1] ?? 1;
    const pairs = Object.entries(dna.pairs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { styles, max, pairs };
  }, [dna]);

  if (!items || !stats)
    return (
      <div>
        <PageHead kicker="the numbers" title="Insights" />
        <div className="shimmer h-72 rounded-2xl" />
      </div>
    );

  if (items.length === 0)
    return (
      <div>
        <PageHead kicker="the numbers" title="Insights" />
        <div className="card mx-auto max-w-md px-6 py-10 text-center">
          <p className="text-sm text-muted">
            Add pieces and log wears — Armoire will show cost-per-wear, neglected pieces, colour
            balance and where your wardrobe has gaps.
          </p>
          <Link href="/add" className="btn-bronze mt-5 inline-block px-6 py-2.5 text-[13.5px] font-semibold">
            Add pieces
          </Link>
        </div>
      </div>
    );

  return (
    <div>
      <PageHead
        kicker="the numbers"
        title="Insights"
        right={
          <button onClick={() => setSettingsOpen(true)} className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            <ISliders style={{ width: 14, height: 14 }} /> Preferences
          </button>
        }
      />

      {/* overview */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { v: `${items.length}`, l: "pieces" },
          { v: `${stats.totalWears}`, l: "wears logged" },
          { v: `${(outfits ?? []).length}`, l: "saved looks" },
          { v: fmtMoney(stats.value), l: "closet value" },
        ].map((s) => (
          <div key={s.l} className="card px-4 py-4 text-center">
            <div className="font-display text-2xl">{s.v}</div>
            <div className="micro mt-1 text-faint">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* wardrobe gaps */}
        <Card kicker="smart shopping" title="Wardrobe gaps">
          {gaps.length === 0 ? (
            <p className="text-[13px] text-muted">No obvious gaps — your closet composes beautifully.</p>
          ) : (
            <div className="space-y-3">
              {gaps.map((g) => (
                <div key={g.attrs.name} className="flex items-center gap-3 rounded-xl border border-linefaint bg-surface p-3">
                  <span className="h-9 w-9 shrink-0 rounded-full border border-ink/10" style={{ background: colorHex(g.attrs.colors[0]) }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{g.attrs.name}</div>
                    <div className="text-[11.5px] text-muted">would unlock {plural(g.unlocked, "new look")}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await db.wishlist.add({ id: uid(), ...g.attrs, createdAt: Date.now() });
                      toast("Added to wishlist");
                    }}
                    className="btn-ghost shrink-0 px-3 py-1.5 text-[11.5px] font-semibold"
                  >
                    Wishlist
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* style DNA */}
        <Card kicker="learned taste" title="Style DNA">
          {dnaTop.styles.length === 0 ? (
            <p className="text-[13px] text-muted">Wear and save looks — Armoire learns what you reach for.</p>
          ) : (
            <>
              <div className="space-y-2">
                {dnaTop.styles.map(([s, n]) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-20 text-[12px] font-medium capitalize text-soft">{s}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-linefaint">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(n / dnaTop.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {dnaTop.pairs.length > 0 && (
                <div className="mt-4">
                  <div className="micro mb-2 text-faint">colour pairings you live in</div>
                  <div className="flex flex-wrap gap-2">
                    {dnaTop.pairs.map(([pair, n]) => {
                      const [a, b] = pair.split("|");
                      return (
                        <span key={pair} className="flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1">
                          <span className="h-3.5 w-3.5 rounded-full border border-ink/10" style={{ background: colorHex(a) }} />
                          <span className="h-3.5 w-3.5 rounded-full border border-ink/10" style={{ background: colorHex(b) }} />
                          <span className="text-[10.5px] font-semibold text-muted">{n}×</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* most worn */}
        <Card kicker="heavy rotation" title="Most worn">
          {stats.mostWorn.length === 0 ? (
            <p className="text-[13px] text-muted">Log wears to see your true favourites.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.mostWorn.map(({ item, count }, i) => (
                <Link key={item.id} href={`/item/${item.id}`} className="flex items-center gap-3">
                  <span className="font-display w-5 text-lg text-faint">{i + 1}</span>
                  <span className="h-11 w-11 shrink-0 rounded-lg border border-linefaint bg-card p-1">
                    <BlobImg blob={item.thumb} className="h-full w-full object-contain" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{item.name}</div>
                    <div className="h-1 overflow-hidden rounded-full bg-linefaint">
                      <div className="h-full rounded-full bg-champagne" style={{ width: `${(count / (stats.mostWorn[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold text-muted">{count}×</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* neglected */}
        <Card kicker="forgotten hangers" title="Needs some love">
          {stats.neglected.length === 0 ? (
            <p className="text-[13px] text-muted">Everything gets worn — impressive.</p>
          ) : (
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
              {stats.neglected.map(({ item, count }) => (
                <div key={item.id} className="w-24 shrink-0 rounded-xl border border-line bg-card p-2 text-center">
                  <Link href={`/item/${item.id}`}>
                    <BlobImg blob={item.thumb} className="mx-auto aspect-square w-full object-contain" />
                  </Link>
                  <div className="mt-1 truncate text-[10.5px] font-medium">{item.name}</div>
                  <div className="text-[9.5px] text-faint">{count === 0 ? "never worn" : `${count}× worn`}</div>
                  <Link href={`/?item=${item.id}`} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-accent">
                    <ISparkle style={{ width: 10, height: 10 }} /> style it
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* cost per wear */}
        <Card kicker="value" title="Cost per wear">
          {stats.bestCpw.length === 0 ? (
            <p className="text-[13px] text-muted">Add prices to pieces and log wears to see what truly earns its keep.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="micro mb-2 text-sage">earning its keep</div>
                {stats.bestCpw.map(({ item, cpw }) => (
                  <CpwRow key={item.id} item={item} cpw={cpw} />
                ))}
              </div>
              <div>
                <div className="micro mb-2 text-clay">still expensive</div>
                {stats.worstCpw.map(({ item, cpw }) => (
                  <CpwRow key={item.id} item={item} cpw={cpw} />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* colours */}
        <Card kicker="palette" title="Colour balance">
          <ShareBar label="in the closet" data={stats.closetColors} />
          <div className="h-3" />
          <ShareBar label="actually worn" data={stats.wornColors} />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {SEASONS.map((s) => {
              const max = Math.max(1, ...[...stats.seasonUse.values()]);
              const v = stats.seasonUse.get(s) ?? 0;
              return (
                <div key={s} className="text-center">
                  <div className="mx-auto flex h-16 w-3 items-end overflow-hidden rounded-full bg-linefaint">
                    <div className="w-full rounded-full bg-accent/70" style={{ height: `${(v / max) * 100}%` }} />
                  </div>
                  <div className="micro mt-1.5 text-faint">{s.slice(0, 3)}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* versatility */}
        <Card kicker="workhorses" title="Matches the most looks">
          {versatile.length === 0 ? (
            <p className="text-[13px] text-muted">Add a few more pieces to compute this.</p>
          ) : (
            <div className="space-y-2.5">
              {versatile.map(({ item, n }) => (
                <Link key={item.id} href={`/item/${item.id}`} className="flex items-center gap-3">
                  <span className="h-11 w-11 shrink-0 rounded-lg border border-linefaint bg-card p-1">
                    <BlobImg blob={item.thumb} className="h-full w-full object-contain" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{item.name}</div>
                    <div className="text-[11px] text-faint">{item.brand ?? "—"}</div>
                  </div>
                  <span className="text-[12px] font-semibold text-accent">{n} looks</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* tools */}
        <Card kicker="tools" title="Go further">
          <div className="space-y-2.5">
            <Link href="/pack" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-champagne">
              <ISuitcase className="text-accent" style={{ width: 20, height: 20 }} />
              <div>
                <div className="text-[13.5px] font-semibold">Packing list</div>
                <div className="text-[11.5px] text-muted">A tight capsule for your next trip, weather-checked.</div>
              </div>
            </Link>
            <Link href="/closet" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-champagne">
              <ISparkle className="text-accent" style={{ width: 20, height: 20 }} />
              <div>
                <div className="text-[13.5px] font-semibold">Capsule wardrobe</div>
                <div className="text-[11.5px] text-muted">Distil the closet to its hardest-working pieces.</div>
              </div>
            </Link>
            {stats.repeatLook && stats.repeatLook[1] > 1 && (
              <div className="rounded-xl border border-linefaint bg-surface p-3.5 text-[12px] text-muted">
                Your most repeated look was worn <strong className="text-ink">{stats.repeatLook[1]}×</strong> —
                {" "}Armoire steers you away from repeats within two weeks.
              </div>
            )}
          </div>
        </Card>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Card({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="micro mb-1 text-accent">{kicker}</div>
      <h3 className="font-display mb-3 text-xl">{title}</h3>
      {children}
    </div>
  );
}

function CpwRow({ item, cpw }: { item: Item; cpw: number }) {
  return (
    <Link href={`/item/${item.id}`} className="mb-1.5 flex items-center gap-2">
      <span className="h-8 w-8 shrink-0 rounded-md border border-linefaint bg-card p-0.5">
        <BlobImg blob={item.thumb} className="h-full w-full object-contain" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{item.name}</span>
      <span className="text-[11.5px] font-semibold text-muted">{fmtMoney(cpw)}</span>
    </Link>
  );
}

function ShareBar({ label, data }: { label: string; data: Map<string, number> }) {
  const total = [...data.values()].reduce((s, n) => s + n, 0);
  const entries = [...data.entries()].sort((a, b) => b[1] - a[1]);
  if (total === 0) return null;
  return (
    <div>
      <div className="micro mb-1.5 text-faint">{label}</div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-linefaint">
        {entries.map(([name, n]) => (
          <span key={name} title={`${name} ${(100 * n / total).toFixed(0)}%`} style={{ width: `${(n / total) * 100}%`, background: colorHex(name) }} />
        ))}
      </div>
    </div>
  );
}
