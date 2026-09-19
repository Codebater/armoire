import Dexie, { type EntityTable } from "dexie";
import type {
  EventRec,
  Item,
  Outfit,
  Plan,
  Setting,
  StyleDNA,
  Wear,
} from "./types";
import type { WishItem } from "./types";
import { EMPTY_DNA } from "./types";

class ArmoireDB extends Dexie {
  items!: EntityTable<Item, "id">;
  outfits!: EntityTable<Outfit, "id">;
  wears!: EntityTable<Wear, "id">;
  plans!: EntityTable<Plan, "id">;
  events!: EntityTable<EventRec, "id">;
  wishlist!: EntityTable<WishItem, "id">;
  settings!: EntityTable<Setting, "key">;
}

export const db = new ArmoireDB("armoire");

db.version(1).stores({
  items: "id, kind, fav, laundry, createdAt, *colors, *seasons, *occasions, *styles",
  outfits: "id, hash, fav, createdAt, *itemIds",
  wears: "id, date, outfitHash, createdAt, *itemIds",
  plans: "id, &date",
  events: "id, date",
  wishlist: "id, kind, createdAt",
  settings: "key",
});

export function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function outfitHash(itemIds: string[]): string {
  return [...itemIds].sort().join("+");
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Update the learned style profile from a worn/saved combination. */
export async function bumpDNA(items: Item[]): Promise<void> {
  const dna = await getSetting<StyleDNA>("dna", EMPTY_DNA);
  const next: StyleDNA = {
    pairs: { ...dna.pairs },
    styles: { ...dna.styles },
  };
  const prim = items.filter((i) => ["top", "bottom", "dress", "outer"].includes(i.kind) && i.colors.length);
  for (let i = 0; i < prim.length; i++) {
    for (let j = i + 1; j < prim.length; j++) {
      const key = [prim[i].colors[0], prim[j].colors[0]].sort().join("|");
      next.pairs[key] = (next.pairs[key] ?? 0) + 1;
    }
  }
  for (const it of items) {
    for (const s of it.styles) next.styles[s] = (next.styles[s] ?? 0) + 1;
  }
  await setSetting("dna", next);
}

export async function logWear(items: Item[], date?: string, occasion?: Wear["occasion"]): Promise<void> {
  const ids = items.map((i) => i.id);
  await db.wears.add({
    id: uid(),
    date: date ?? todayISO(),
    itemIds: ids,
    outfitHash: outfitHash(ids),
    occasion,
    createdAt: Date.now(),
  });
  await bumpDNA(items);
}

/** Delete an item and every reference that no longer makes sense without it. */
export async function deleteItemCascade(id: string): Promise<void> {
  await db.transaction("rw", [db.items, db.outfits, db.plans], async () => {
    await db.items.delete(id);
    const outs = await db.outfits.where("itemIds").equals(id).toArray();
    await db.outfits.bulkDelete(outs.map((o) => o.id));
    const plans = await db.plans.filter((p) => p.itemIds.includes(id)).toArray();
    await db.plans.bulkDelete(plans.map((p) => p.id));
  });
}

export async function wipeAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
