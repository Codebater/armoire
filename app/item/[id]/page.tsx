"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { AttrEditor, type EditableAttrs } from "@/components/attr-editor";
import { IChevronL, IDrop, IHeart, IPencil, ISparkle, ITrash } from "@/components/icons";
import { MiniLook, partsFromItems } from "@/components/mini-look";
import { BlobImg, ColorDots, Sheet, useToast } from "@/components/ui";
import { db, deleteItemCascade, todayISO } from "@/lib/db";
import { defaultCtx, enumerateLooks, seasonFor, type Look } from "@/lib/engine";
import { fmtMoney, relDays } from "@/lib/format";
import { useSetting } from "@/lib/hooks";
import type { City, Item } from "@/lib/types";
import { KIND_ONE } from "@/lib/types";

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const item = useLiveQuery(() => db.items.get(id), [id]);
  const items = useLiveQuery(() => db.items.toArray(), []);
  const wears = useLiveQuery(() => db.wears.where("itemIds").equals(id).toArray(), [id]);
  const outfits = useLiveQuery(() => db.outfits.where("itemIds").equals(id).toArray(), [id]);
  const allById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const [city] = useSetting<City | null>("city", null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [attrs, setAttrs] = useState<EditableAttrs | null>(null);

  const stats = useMemo(() => {
    const count = wears?.length ?? 0;
    const last = wears?.length ? [...wears].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date : null;
    return { count, last };
  }, [wears]);

  const versatility = useMemo(() => {
    if (!item || !items || item.kind === "accessory") return null;
    const ctx = defaultCtx(todayISO(), seasonFor(new Date(), city?.lat ?? undefined));
    const slot = (item.kind === "bag" ? "bag" : item.kind) as keyof Look;
    const looks = enumerateLooks(items, ctx, { lock: { [slot]: item } as Partial<Look>, cap: 700 }).filter(
      (l) => l.score >= 68,
    );
    const partners = new Map<string, number>();
    for (const l of looks)
      for (const i of l.items) if (i.id !== item.id) partners.set(i.id, (partners.get(i.id) ?? 0) + 1);
    const top = [...partners.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pid]) => allById.get(pid))
      .filter(Boolean) as Item[];
    return { count: looks.length, top, best: looks.slice(0, 3) };
  }, [item, items, city?.lat, allById]);

  if (item === undefined) return <div className="shimmer mx-auto h-96 max-w-lg rounded-2xl" />;
  if (item === null || !item)
    return (
      <div className="mx-auto max-w-lg text-center text-muted">
        This piece is gone. <Link className="underline" href="/closet">Back to closet</Link>
      </div>
    );

  const openEdit = () => {
    setAttrs({
      kind: item.kind,
      name: item.name,
      brand: item.brand ?? "",
      price: item.price?.toString() ?? "",
      colors: [...item.colors],
      styles: [...item.styles],
      seasons: [...item.seasons],
      occasions: [...item.occasions],
      warmth: item.warmth,
      formality: item.formality,
      notes: item.notes ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!attrs) return;
    await db.items.update(item.id, {
      kind: attrs.kind,
      name: attrs.name.trim() || item.name,
      brand: attrs.brand.trim() || undefined,
      price: attrs.price.trim() ? Number(attrs.price.replace(",", ".")) || undefined : undefined,
      colors: attrs.colors.length ? attrs.colors : item.colors,
      styles: attrs.styles,
      seasons: attrs.seasons,
      occasions: attrs.occasions,
      warmth: attrs.warmth,
      formality: attrs.formality,
      notes: attrs.notes.trim() || undefined,
    });
    setEditOpen(false);
    toast("Piece updated");
  };

  const costPerWear =
    item.price !== undefined && stats.count > 0 ? item.price / stats.count : undefined;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/closet" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <IChevronL style={{ width: 15, height: 15 }} /> Closet
      </Link>

      <div className="card alpha-grid relative overflow-hidden p-8">
        <BlobImg blob={item.image} alt={item.name} className="mx-auto max-h-80 w-full object-contain drop-shadow-[0_16px_28px_rgba(27,23,18,0.16)]" />
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            onClick={async () => {
              await db.items.update(item.id, { fav: item.fav ? 0 : 1 });
            }}
            className={`grid h-9 w-9 place-items-center rounded-full border ${item.fav ? "border-clay bg-clay text-card" : "border-line bg-card text-muted"}`}
            aria-label="Favourite"
          >
            <IHeart filled={item.fav === 1} style={{ width: 15, height: 15 }} />
          </button>
          <button
            onClick={async () => {
              await db.items.update(item.id, { laundry: item.laundry ? 0 : 1 });
              toast(item.laundry ? "Back in rotation" : "Sent to laundry");
            }}
            className={`grid h-9 w-9 place-items-center rounded-full border ${item.laundry ? "bg-card text-card border-line" : "border-line bg-card text-muted"}`}
            style={item.laundry ? { background: "#54718F", borderColor: "#54718F" } : undefined}
            aria-label="Laundry"
          >
            <IDrop style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="micro text-accent">{KIND_ONE[item.kind]}</div>
          <h1 className="font-display mt-1 text-3xl leading-tight">{item.name}</h1>
          <div className="mt-1 text-[13px] text-muted">
            {item.brand ?? "no brand"} · {fmtMoney(item.price)}
            {item.aiTagged && <span className="ml-2 rounded-full bg-linefaint px-2 py-0.5 text-[10.5px] font-semibold text-accent">AI tagged</span>}
          </div>
        </div>
        <ColorDots names={item.colors} size={16} />
      </div>

      {/* tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...item.styles, ...item.seasons, ...item.occasions].map((t) => (
          <span key={t} className="rounded-full bg-linefaint px-2.5 py-1 text-[11px] font-medium capitalize text-soft">
            {t}
          </span>
        ))}
      </div>

      {/* stats */}
      <div className="mt-5 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-card text-center">
        {[
          { v: `${stats.count}×`, l: "worn" },
          { v: stats.last ? relDays(stats.last, todayISO()) : "never", l: "last worn" },
          { v: costPerWear !== undefined ? fmtMoney(costPerWear) : "—", l: "per wear" },
          { v: versatility ? `${versatility.count}` : "—", l: "strong looks" },
        ].map((s) => (
          <div key={s.l} className="px-1 py-3.5">
            <div className="font-display text-lg leading-none">{s.v}</div>
            <div className="micro mt-1.5 text-faint">{s.l}</div>
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/?item=${item.id}`} className="btn-bronze flex items-center justify-center gap-2 py-3 text-[13.5px] font-semibold">
          <ISparkle style={{ width: 15, height: 15 }} /> Style this
        </Link>
        <button onClick={openEdit} className="btn-ghost flex items-center justify-center gap-2 py-3 text-[13.5px] font-semibold">
          <IPencil style={{ width: 15, height: 15 }} /> Edit details
        </button>
      </div>

      {/* pairings */}
      {versatility && versatility.top.length > 0 && (
        <div className="mt-6">
          <div className="micro mb-2 text-muted">plays best with</div>
          <div className="flex gap-2">
            {versatility.top.map((p) => (
              <Link key={p.id} href={`/item/${p.id}`} className="card w-24 p-2 text-center transition-transform hover:-translate-y-0.5">
                <BlobImg blob={p.thumb} className="mx-auto aspect-square w-full object-contain" />
                <div className="mt-1 truncate text-[10.5px] font-medium text-muted">{p.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* looks containing */}
      {(outfits ?? []).length > 0 && (
        <div className="mt-6">
          <div className="micro mb-2 text-muted">in saved looks</div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {(outfits ?? []).map((o) => (
              <Link key={o.id} href={`/?outfit=${o.id}`}>
                <MiniLook parts={partsFromItems(o.itemIds.map((oid) => allById.get(oid)).filter(Boolean) as Item[])} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* delete */}
      <div className="mt-8 border-t border-line pt-4 text-center">
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-faint hover:text-clay">
            <ITrash style={{ width: 13, height: 13 }} /> Remove from closet
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3 text-[13px]">
            <span className="text-muted">Delete {item.name}? Saved looks using it go too.</span>
            <button
              onClick={async () => {
                await deleteItemCascade(item.id);
                toast("Piece removed");
                router.push("/closet");
              }}
              className="rounded-full bg-clay px-3.5 py-1.5 font-semibold text-card"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDel(false)} className="btn-ghost px-3.5 py-1.5">
              Keep
            </button>
          </div>
        )}
      </div>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit piece" wide>
        {attrs && (
          <div className="space-y-4">
            <AttrEditor value={attrs} onChange={setAttrs} />
            <button onClick={saveEdit} className="btn-primary w-full py-3 text-[14px] font-semibold">
              Save changes
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
