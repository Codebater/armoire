"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AttrEditor, DEFAULT_ATTRS, type EditableAttrs } from "@/components/attr-editor";
import { IPlus, ISearch, ISparkle, ITrash } from "@/components/icons";
import { ItemCard } from "@/components/item-card";
import { MiniLook } from "@/components/mini-look";
import {
  BlobImg,
  Chip,
  EmptyState,
  Field,
  PageHead,
  Seg,
  Sheet,
  Spinner,
  inputCls,
  useToast,
} from "@/components/ui";
import { COLOR_DEFS, colorHex } from "@/lib/colors";
import { db, todayISO, uid } from "@/lib/db";
import { buildCapsule, defaultCtx, seasonFor, wishlistMatch, type CapsuleResult } from "@/lib/engine";
import { useDebounced, useSetting } from "@/lib/hooks";
import { finalizeImage, processUpload } from "@/lib/images";
import { matchItem, parseQuery } from "@/lib/search";
import type { City, Item, Kind, WishItem } from "@/lib/types";
import { KIND_LABEL, KINDS, SEASONS } from "@/lib/types";

type Tab = "items" | "wishlist" | "capsule";

export default function ClosetPage() {
  const [tab, setTab] = useState<Tab>("items");
  const items = useLiveQuery(() => db.items.orderBy("createdAt").reverse().toArray(), []);
  const wears = useLiveQuery(() => db.wears.toArray(), []);
  const [city] = useSetting<City | null>("city", null);

  const wearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wears ?? []) for (const id of w.itemIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [wears]);

  const ctx = useMemo(
    () => defaultCtx(todayISO(), seasonFor(new Date(), city?.lat ?? undefined)),
    [city?.lat],
  );

  return (
    <div>
      <PageHead
        kicker="the collection"
        title="Closet"
        right={<Seg options={[{ value: "items" as Tab, label: "Pieces" }, { value: "wishlist" as Tab, label: "Wishlist" }, { value: "capsule" as Tab, label: "Capsule" }]} value={tab} onChange={setTab} />}
      />
      {tab === "items" && <ItemsTab items={items} wearCounts={wearCounts} />}
      {tab === "wishlist" && <WishlistTab items={items ?? []} ctx={ctx} />}
      {tab === "capsule" && <CapsuleTab items={items ?? []} ctx={ctx} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pieces                                                            */
/* ---------------------------------------------------------------- */

function ItemsTab({
  items,
  wearCounts,
}: {
  items: Item[] | undefined;
  wearCounts: Map<string, number>;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [colors, setColors] = useState<string[]>([]);
  const [onlyLaundry, setOnlyLaundry] = useState(false);
  const [onlyUnworn, setOnlyUnworn] = useState(false);

  const filtered = useMemo(() => {
    if (!items) return [];
    const parsed = parseQuery(dq);
    return items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (colors.length && !colors.some((c) => i.colors.includes(c))) return false;
      if (onlyLaundry && i.laundry !== 1) return false;
      if (onlyUnworn && (wearCounts.get(i.id) ?? 0) > 0) return false;
      if (dq.trim() && !matchItem(i, parsed, wearCounts.get(i.id) ?? 0)) return false;
      return true;
    });
  }, [items, dq, kind, colors, onlyLaundry, onlyUnworn, wearCounts]);

  const counts = useMemo(() => {
    const m = new Map<Kind, number>();
    for (const i of items ?? []) m.set(i.kind, (m.get(i.kind) ?? 0) + 1);
    return m;
  }, [items]);

  if (items === undefined)
    return <div className="shimmer h-64 rounded-2xl" />;

  if (items.length === 0)
    return (
      <EmptyState title="An empty armoire" body="Photograph your pieces and they'll hang here — cut out, tagged and ready to style.">
        <Link href="/add" className="btn-bronze px-6 py-2.5 text-[13.5px] font-semibold">
          Add pieces
        </Link>
      </EmptyState>
    );

  return (
    <div>
      {/* search */}
      <div className="relative mb-3">
        <ISearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" style={{ width: 16, height: 16 }} />
        <input
          className={`${inputCls} pl-10`}
          placeholder='Try "black dress", "work winter", "unworn"…'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* kind chips */}
      <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
        <Chip active={kind === "all"} onClick={() => setKind("all")}>
          All · {items.length}
        </Chip>
        {KINDS.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "all" : k)}>
            {KIND_LABEL[k]} · {counts.get(k)}
          </Chip>
        ))}
      </div>

      {/* colour + state filters */}
      <div className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto py-1">
        {COLOR_DEFS.filter((c) => (items ?? []).some((i) => i.colors.includes(c.name))).map((c) => (
          <button
            key={c.name}
            title={c.name}
            onClick={() =>
              setColors((cs) => (cs.includes(c.name) ? cs.filter((x) => x !== c.name) : [...cs, c.name]))
            }
            className={`h-6 w-6 shrink-0 rounded-full border-2 transition-transform active:scale-90 ${colors.includes(c.name) ? "scale-110 border-ink" : "border-ink/10"}`}
            style={{ background: c.hex }}
          />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Chip active={onlyUnworn} onClick={() => setOnlyUnworn(!onlyUnworn)}>
          Never worn
        </Chip>
        <Chip active={onlyLaundry} onClick={() => setOnlyLaundry(!onlyLaundry)}>
          In laundry
        </Chip>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">Nothing matches that — try fewer filters.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((i) => (
            <ItemCard key={i.id} item={i} wearCount={wearCounts.get(i.id) ?? 0} />
          ))}
          <Link
            href="/add"
            className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line text-faint transition-colors hover:border-champagne hover:text-accent"
          >
            <span className="flex flex-col items-center gap-2 text-[12.5px] font-medium">
              <IPlus style={{ width: 20, height: 20 }} /> Add piece
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Wishlist                                                          */
/* ---------------------------------------------------------------- */

function WishlistTab({ items, ctx }: { items: Item[]; ctx: ReturnType<typeof defaultCtx> }) {
  const toast = useToast();
  const wishes = useLiveQuery(() => db.wishlist.orderBy("createdAt").reverse().toArray(), []);
  const [sheet, setSheet] = useState(false);
  const [attrs, setAttrs] = useState<EditableAttrs>({ ...DEFAULT_ATTRS, occasions: ["casual"], name: "" });
  const [url, setUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const m = new Map<string, ReturnType<typeof wishlistMatch>>();
    for (const w of wishes ?? []) {
      m.set(w.id, wishlistMatch(w, items, ctx));
    }
    return m;
  }, [wishes, items, ctx]);

  const saveWish = async () => {
    setSaving(true);
    try {
      let image: Blob | undefined;
      if (photo) {
        const processed = await processUpload(photo, true);
        image = processed.thumb;
      }
      const wish: WishItem = {
        id: uid(),
        kind: attrs.kind,
        name: attrs.name.trim() || "Wishlist piece",
        brand: attrs.brand.trim() || undefined,
        colors: attrs.colors,
        styles: attrs.styles,
        seasons: attrs.seasons,
        occasions: attrs.occasions,
        warmth: attrs.warmth,
        formality: attrs.formality,
        price: attrs.price.trim() ? Number(attrs.price.replace(",", ".")) || undefined : undefined,
        url: url.trim() || undefined,
        image,
        createdAt: Date.now(),
      };
      await db.wishlist.add(wish);
      setSheet(false);
      setAttrs({ ...DEFAULT_ATTRS, name: "" });
      setPhoto(null);
      setUrl("");
      toast("Added to wishlist");
    } finally {
      setSaving(false);
    }
  };

  const toCloset = async (w: WishItem) => {
    let image = w.image;
    if (!image) {
      // colour swatch placeholder
      const c = document.createElement("canvas");
      c.width = c.height = 420;
      const g = c.getContext("2d")!;
      g.fillStyle = colorHex(w.colors[0] ?? "grey");
      g.beginPath();
      g.roundRect(60, 60, 300, 300, 40);
      g.fill();
      image = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
    }
    const fin = await finalizeImage(image, true);
    await db.items.add({
      id: uid(),
      kind: w.kind,
      name: w.name,
      brand: w.brand,
      colors: w.colors,
      styles: w.styles,
      seasons: w.seasons,
      occasions: w.occasions,
      warmth: w.warmth,
      formality: w.formality,
      price: w.price,
      fav: 0,
      laundry: 0,
      createdAt: Date.now(),
      image: fin.image,
      thumb: fin.thumb,
    });
    await db.wishlist.delete(w.id);
    toast(`${w.name} joined your closet`);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="max-w-md text-[13px] text-muted">
          Considering a purchase? See how it would work with what you already own — before you buy.
        </p>
        <button onClick={() => setSheet(true)} className="btn-primary shrink-0 px-4 py-2 text-[13px] font-semibold">
          + Add wish
        </button>
      </div>

      {(wishes ?? []).length === 0 ? (
        <EmptyState title="Nothing coveted yet" body="Add a piece you're eyeing and Armoire will tell you how hard it would work in your wardrobe." />
      ) : (
        <div className="space-y-3">
          {(wishes ?? []).map((w) => {
            const m = matches.get(w.id);
            return (
              <div key={w.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="alpha-grid h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-linefaint bg-surface p-1.5">
                    {w.image ? (
                      <BlobImg blob={w.image} className="h-full w-full object-contain" />
                    ) : (
                      <span className="grid h-full w-full place-items-center rounded-lg" style={{ background: colorHex(w.colors[0] ?? "grey") }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold">{w.name}</div>
                    <div className="text-[12px] text-muted">
                      {w.brand ?? KIND_LABEL[w.kind]}
                      {w.price ? ` · €${w.price}` : ""}
                    </div>
                    {m && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent">
                        <ISparkle style={{ width: 13, height: 13 }} />
                        Pairs with {m.pairsWith} pieces · unlocks {m.unlocked} looks
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 md:justify-end">
                  <div className="flex gap-2">
                    {m?.best.slice(0, 3).map((l) => (
                      <MiniLook key={l.hash} parts={l} className="h-20 w-16" />
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => toCloset(w)} className="btn-ghost px-3.5 py-1.5 text-[12px] font-semibold">
                      Bought it
                    </button>
                    <button
                      onClick={async () => {
                        await db.wishlist.delete(w.id);
                      }}
                      className="flex items-center justify-center gap-1 text-[11.5px] text-faint hover:text-clay"
                    >
                      <ITrash style={{ width: 12, height: 12 }} /> remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Add to wishlist" wide>
        <div className="space-y-4">
          <AttrEditor value={attrs} onChange={setAttrs} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Link (optional)">
              <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Photo (optional)">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-[12.5px] text-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-card file:px-3.5 file:py-2 file:text-[12px] file:font-semibold file:text-soft"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </Field>
          </div>
          <button onClick={saveWish} disabled={saving} className="btn-bronze w-full py-3 text-[14px] font-semibold disabled:opacity-60">
            {saving ? <Spinner className="border-card/40 border-t-card" /> : "Add wish"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Capsule                                                           */
/* ---------------------------------------------------------------- */

function CapsuleTab({ items, ctx }: { items: Item[]; ctx: ReturnType<typeof defaultCtx> }) {
  const toast = useToast();
  const [size, setSize] = useState(16);
  const [result, setResult] = useState<CapsuleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedIds, setSavedIds] = useSetting<string[]>("capsule", []);
  const savedItems = useMemo(() => items.filter((i) => savedIds.includes(i.id)), [items, savedIds]);

  const build = () => {
    setBusy(true);
    setTimeout(() => {
      setResult(buildCapsule(items, ctx, size));
      setBusy(false);
    }, 30);
  };

  if (items.length < 8)
    return <EmptyState title="Capsule needs more pieces" body="Add at least 8 pieces and Armoire will distil your closet into a tight travel-ready capsule." />;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="micro mb-1 text-accent">capsule wardrobe</div>
        <h3 className="font-display text-2xl">Less closet, more outfits</h3>
        <p className="mt-1.5 max-w-lg text-[13px] text-muted">
          Armoire picks your {size} hardest-working pieces — the set that combines into the most
          strong looks.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={Math.min(26, items.length)}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="flex-1 accent-[#8f6b3f]"
          />
          <span className="font-display w-10 text-2xl">{size}</span>
          <button onClick={build} className="btn-primary px-5 py-2.5 text-[13px] font-semibold">
            {busy ? <Spinner className="border-card/40 border-t-card" /> : "Distil"}
          </button>
        </div>
      </div>

      {result && (
        <div className="card fade-up p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="font-display text-3xl">{result.lookCount}</span>
              <span className="ml-2 text-[13px] text-muted">strong looks from {result.items.length} pieces</span>
            </div>
            <button
              onClick={() => {
                setSavedIds(result.items.map((i) => i.id));
                toast("Capsule saved");
              }}
              className="btn-ghost px-4 py-2 text-[12.5px] font-semibold"
            >
              Save capsule
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {result.items.map((i) => (
              <Link key={i.id} href={`/item/${i.id}`} className="rounded-xl border border-line bg-card p-1.5 transition-transform hover:-translate-y-0.5">
                <BlobImg blob={i.thumb} className="aspect-square w-full object-contain" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {savedItems.length > 0 && (
        <div className="card p-5">
          <div className="micro mb-3 text-muted">saved capsule · {savedItems.length} pieces</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {savedItems.map((i) => (
              <Link key={i.id} href={`/item/${i.id}`} className="rounded-xl border border-line bg-card p-1.5">
                <BlobImg blob={i.thumb} className="aspect-square w-full object-contain" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
