import { colorHex } from "./colors";
import { db, outfitHash, setSetting, toISODate, uid } from "./db";
import { finalizeImage } from "./images";
import { garmentBlob, type Shape } from "./seed-art";
import type { Item, Occasion, Season, StyleDNA, StyleTag } from "./types";

interface Spec {
  key: string;
  shape: Shape;
  color: string; // palette color name (primary)
  color2?: string;
  hex?: string; // override render hex
  plaid?: boolean;
  kind: Item["kind"];
  name: string;
  brand: string;
  styles: StyleTag[];
  seasons: Season[];
  occasions: Occasion[];
  warmth: number;
  formality: number;
  price: number;
  fav?: boolean;
}

const ALL: Season[] = ["spring", "summer", "autumn", "winter"];
const WARM: Season[] = ["spring", "summer"];
const COOL: Season[] = ["autumn", "winter"];

const SPECS: Spec[] = [
  // Tops
  { key: "tee-white", shape: "tee", color: "white", kind: "top", name: "Boxy Tee", brand: "Aire", styles: ["minimal"], seasons: ALL, occasions: ["casual", "travel", "sport"], warmth: 0, formality: 1, price: 35, fav: true },
  { key: "tee-black", shape: "tee", color: "black", kind: "top", name: "Crew Tee", brand: "Aire", styles: ["minimal", "street"], seasons: ALL, occasions: ["casual", "travel"], warmth: 0, formality: 1, price: 35 },
  { key: "blouse-ivory", shape: "blouse", color: "cream", hex: "#F0E7D8", kind: "top", name: "Silk Blouse", brand: "Maison Noé", styles: ["elegant", "classic"], seasons: ALL, occasions: ["work", "dinner", "formal"], warmth: 1, formality: 3, price: 190, fav: true },
  { key: "blouse-burgundy", shape: "blouse", color: "burgundy", kind: "top", name: "Satin Blouse", brand: "Maison Noé", styles: ["romantic", "elegant"], seasons: COOL, occasions: ["dinner", "party"], warmth: 1, formality: 3, price: 165 },
  { key: "knit-camel", shape: "knit", color: "camel", kind: "top", name: "Cashmere Knit", brand: "Ruelle", styles: ["minimal", "classic"], seasons: ["autumn", "winter", "spring"], occasions: ["casual", "work"], warmth: 2, formality: 2, price: 240, fav: true },
  { key: "knit-sage", shape: "knit", color: "sage", kind: "top", name: "Fine-Gauge Knit", brand: "Ruelle", styles: ["minimal", "romantic"], seasons: ["spring", "autumn"], occasions: ["casual", "work"], warmth: 2, formality: 2, price: 150 },
  { key: "turtle-black", shape: "turtleneck", color: "black", kind: "top", name: "Roll-Neck", brand: "Studio K", styles: ["minimal", "elegant"], seasons: COOL, occasions: ["work", "dinner", "casual"], warmth: 2, formality: 2, price: 95 },
  { key: "shirt-denim", shape: "blouse", color: "denim", kind: "top", name: "Chambray Shirt", brand: "Form", styles: ["street", "classic"], seasons: ["spring", "autumn"], occasions: ["casual", "travel"], warmth: 1, formality: 1, price: 85 },

  // Bottoms
  { key: "jeans-raw", shape: "jeans", color: "denim", hex: "#3F5875", kind: "bottom", name: "Raw Straight Jeans", brand: "Form", styles: ["classic", "street"], seasons: ALL, occasions: ["casual", "travel"], warmth: 2, formality: 1, price: 140, fav: true },
  { key: "trouser-black", shape: "trousers", color: "black", kind: "bottom", name: "Tailored Trousers", brand: "Studio K", styles: ["classic", "minimal"], seasons: ALL, occasions: ["work", "dinner", "formal"], warmth: 1, formality: 3, price: 160 },
  { key: "wide-cream", shape: "wideleg", color: "cream", kind: "bottom", name: "Wide-Leg Pant", brand: "Maison Noé", styles: ["elegant", "minimal"], seasons: WARM, occasions: ["work", "dinner", "casual"], warmth: 1, formality: 3, price: 175 },
  { key: "skirt-camel", shape: "skirt", color: "camel", kind: "bottom", name: "Midi Slip Skirt", brand: "Ruelle", styles: ["romantic", "elegant"], seasons: ["spring", "summer", "autumn"], occasions: ["work", "dinner", "casual"], warmth: 1, formality: 3, price: 120 },
  { key: "mini-black", shape: "mini", color: "black", kind: "bottom", name: "A-Line Mini", brand: "Studio K", styles: ["edgy", "minimal"], seasons: ALL, occasions: ["party", "dinner", "casual"], warmth: 0, formality: 2, price: 90 },
  { key: "mini-plaid", shape: "mini", color: "yellow", hex: "#D9B23F", plaid: true, kind: "bottom", name: "Plaid Mini", brand: "Casa 9", styles: ["preppy"], seasons: ["spring", "autumn"], occasions: ["casual", "party"], warmth: 0, formality: 2, price: 110, fav: true },
  { key: "pleat-grey", shape: "pleated", color: "grey", kind: "bottom", name: "Pleated Midi", brand: "Studio K", styles: ["classic", "preppy"], seasons: ["autumn", "winter", "spring"], occasions: ["work", "dinner"], warmth: 1, formality: 3, price: 130 },

  // Dresses
  { key: "slip-black", shape: "slip", color: "black", kind: "dress", name: "Bias Slip Dress", brand: "Maison Noé", styles: ["elegant", "minimal"], seasons: WARM, occasions: ["dinner", "party", "formal"], warmth: 0, formality: 4, price: 210, fav: true },
  { key: "dress-sage", shape: "dressa", color: "sage", kind: "dress", name: "Tea Dress", brand: "Ruelle", styles: ["romantic"], seasons: WARM, occasions: ["casual", "dinner", "travel"], warmth: 1, formality: 2, price: 145 },

  // Layers
  { key: "blazer-black", shape: "blazer", color: "black", kind: "outer", name: "Boyfriend Blazer", brand: "Studio K", styles: ["classic", "minimal"], seasons: ALL, occasions: ["work", "dinner", "formal"], warmth: 2, formality: 3, price: 260, fav: true },
  { key: "blazer-plaid", shape: "blazer", color: "yellow", hex: "#D9B23F", plaid: true, kind: "outer", name: "Plaid Blazer", brand: "Casa 9", styles: ["preppy"], seasons: ["spring", "autumn"], occasions: ["casual", "party"], warmth: 2, formality: 2, price: 230 },
  { key: "coat-camel", shape: "coat", color: "camel", kind: "outer", name: "Wool Wrap Coat", brand: "Maison Noé", styles: ["classic", "elegant"], seasons: COOL, occasions: ["work", "dinner", "casual", "formal"], warmth: 3, formality: 3, price: 390 },
  { key: "jacket-denim", shape: "denimjacket", color: "denim", kind: "outer", name: "Trucker Jacket", brand: "Form", styles: ["street"], seasons: ["spring", "autumn"], occasions: ["casual", "travel"], warmth: 2, formality: 1, price: 120 },

  // Shoes
  { key: "sneaker-white", shape: "sneaker", color: "white", kind: "shoes", name: "Court Sneaker", brand: "Alba", styles: ["minimal", "street"], seasons: ALL, occasions: ["casual", "travel", "sport", "work"], warmth: 1, formality: 1, price: 130, fav: true },
  { key: "heel-black", shape: "heel", color: "black", kind: "shoes", name: "Slingback Heel", brand: "Alba", styles: ["elegant", "classic"], seasons: ALL, occasions: ["dinner", "party", "formal", "work"], warmth: 0, formality: 4, price: 220 },
  { key: "boot-brown", shape: "boot", color: "brown", kind: "shoes", name: "Chelsea Boot", brand: "Alba", styles: ["classic", "edgy"], seasons: COOL, occasions: ["casual", "work", "dinner"], warmth: 2, formality: 2, price: 240 },
  { key: "boot-black", shape: "boot", color: "black", kind: "shoes", name: "Ankle Boot", brand: "Alba", styles: ["edgy", "minimal"], seasons: COOL, occasions: ["casual", "work", "dinner", "party"], warmth: 2, formality: 2, price: 210 },

  // Bags & accessories
  { key: "tote-black", shape: "tote", color: "black", kind: "bag", name: "Structured Tote", brand: "Maison Noé", styles: ["classic", "minimal"], seasons: ALL, occasions: ["work", "casual", "travel"], warmth: 0, formality: 3, price: 320 },
  { key: "cross-tan", shape: "crossbody", color: "camel", hex: "#C09468", kind: "bag", name: "Saddle Crossbody", brand: "Ruelle", styles: ["boho", "classic"], seasons: ALL, occasions: ["casual", "dinner", "party", "travel"], warmth: 0, formality: 2, price: 180 },
  { key: "scarf-silk", shape: "scarf", color: "burgundy", kind: "accessory", name: "Silk Scarf", brand: "Casa 9", styles: ["romantic", "classic"], seasons: ALL, occasions: ["work", "dinner", "casual"], warmth: 0, formality: 3, price: 75 },
  { key: "belt-camel", shape: "beltcoil", color: "camel", hex: "#A97C4F", kind: "accessory", name: "Leather Belt", brand: "Form", styles: ["classic"], seasons: ALL, occasions: ["casual", "work", "dinner"], warmth: 0, formality: 2, price: 60 },
];

/** Plausible wear history: hero combos worn over the past ~8 weeks. */
const WORN_COMBOS: { keys: string[]; occ: Occasion; w: number }[] = [
  { keys: ["tee-white", "jeans-raw", "sneaker-white"], occ: "casual", w: 5 },
  { keys: ["blouse-ivory", "trouser-black", "heel-black", "tote-black"], occ: "work", w: 4 },
  { keys: ["knit-camel", "wide-cream", "boot-brown"], occ: "work", w: 3 },
  { keys: ["turtle-black", "pleat-grey", "boot-black", "tote-black"], occ: "work", w: 3 },
  { keys: ["shirt-denim", "mini-black", "sneaker-white"], occ: "casual", w: 2 },
  { keys: ["slip-black", "heel-black", "cross-tan"], occ: "dinner", w: 2 },
  { keys: ["tee-black", "jeans-raw", "boot-black", "jacket-denim"], occ: "casual", w: 2 },
  { keys: ["knit-camel", "skirt-camel", "boot-brown", "scarf-silk"], occ: "dinner", w: 2 },
];

export interface SeedProgress {
  done: number;
  total: number;
  label: string;
}

export async function seedDemo(onProgress?: (p: SeedProgress) => void): Promise<void> {
  const total = SPECS.length + 4;
  let done = 0;
  const idByKey = new Map<string, string>();
  const itemByKey = new Map<string, Item>();
  const now = Date.now();

  for (const s of SPECS) {
    onProgress?.({ done, total, label: s.name });
    const raw = await garmentBlob(s.shape, s.hex ?? colorHex(s.color), { plaid: s.plaid });
    const { image, thumb } = await finalizeImage(raw, true);
    const item: Item = {
      id: uid(),
      kind: s.kind,
      name: s.name,
      brand: s.brand,
      colors: s.color2 ? [s.color, s.color2] : [s.color],
      styles: s.styles,
      seasons: s.seasons,
      occasions: s.occasions,
      warmth: s.warmth,
      formality: s.formality,
      price: s.price,
      fav: s.fav ? 1 : 0,
      laundry: 0,
      bgRemoved: true,
      createdAt: now - Math.round(Math.random() * 120 + 10) * 86400000,
      image,
      thumb,
    };
    await db.items.add(item);
    idByKey.set(s.key, item.id);
    itemByKey.set(s.key, item);
    done++;
  }

  // Wear history over the past ~8 weeks.
  onProgress?.({ done, total, label: "Wear history" });
  const dna: StyleDNA = { pairs: {}, styles: {} };
  const wearDates: string[] = [];
  for (let d = 56; d >= 1; d--) wearDates.push(toISODate(new Date(now - d * 86400000)));
  const weighted: { keys: string[]; occ: Occasion }[] = [];
  for (const c of WORN_COMBOS) for (let i = 0; i < c.w; i++) weighted.push({ keys: c.keys, occ: c.occ });
  let wi = 0;
  for (let i = 0; i < wearDates.length; i += 2 + (i % 3)) {
    const combo = weighted[wi++ % weighted.length];
    const items = combo.keys.map((k) => itemByKey.get(k)!).filter(Boolean);
    const ids = items.map((x) => x.id);
    await db.wears.add({
      id: uid(),
      date: wearDates[i],
      itemIds: ids,
      outfitHash: outfitHash(ids),
      occasion: combo.occ,
      createdAt: now - (56 - i) * 86400000,
    });
    const prim = items.filter((x) => ["top", "bottom", "dress", "outer"].includes(x.kind));
    for (let a = 0; a < prim.length; a++) {
      for (let b = a + 1; b < prim.length; b++) {
        const key = [prim[a].colors[0], prim[b].colors[0]].sort().join("|");
        dna.pairs[key] = (dna.pairs[key] ?? 0) + 1;
      }
    }
    for (const it of items) for (const st of it.styles) dna.styles[st] = (dna.styles[st] ?? 0) + 1;
  }
  done++;

  // Saved looks.
  onProgress?.({ done, total, label: "Saved looks" });
  const saved: { keys: string[]; occ: Occasion; name: string }[] = [
    { keys: ["blouse-ivory", "trouser-black", "heel-black", "blazer-black", "tote-black"], occ: "work", name: "Boardroom" },
    { keys: ["knit-camel", "wide-cream", "boot-brown", "coat-camel"], occ: "dinner", name: "Caramel tones" },
    { keys: ["tee-white", "mini-plaid", "sneaker-white", "blazer-plaid"], occ: "casual", name: "As if!" },
  ];
  for (const s of saved) {
    const ids = s.keys.map((k) => idByKey.get(k)!).filter(Boolean);
    await db.outfits.add({
      id: uid(),
      itemIds: ids,
      hash: outfitHash(ids),
      occasion: s.occ,
      name: s.name,
      fav: 1,
      createdAt: now - Math.round(Math.random() * 20) * 86400000,
    });
  }
  done++;

  // Wishlist with rendered previews.
  onProgress?.({ done, total, label: "Wishlist" });
  const trench = await garmentBlob("coat", "#C8B08C");
  const trenchImg = await finalizeImage(trench, true);
  await db.wishlist.add({
    id: uid(), kind: "outer", name: "Beige Trench Coat", brand: "Maison Noé",
    colors: ["beige"], styles: ["classic", "elegant"], seasons: ["spring", "autumn"],
    occasions: ["work", "casual", "dinner"], warmth: 2, formality: 3, price: 420,
    image: trenchImg.thumb, createdAt: now,
  });
  const redHeel = await garmentBlob("heel", "#A93030");
  const redHeelImg = await finalizeImage(redHeel, true);
  await db.wishlist.add({
    id: uid(), kind: "shoes", name: "Scarlet Heels", brand: "Alba",
    colors: ["red"], styles: ["elegant", "romantic"], seasons: ["spring", "summer", "autumn", "winter"],
    occasions: ["party", "dinner"], warmth: 0, formality: 4, price: 260,
    image: redHeelImg.thumb, createdAt: now,
  });
  done++;

  // Events + settings.
  onProgress?.({ done, total, label: "Calendar & profile" });
  const nextDow = (dow: number) => {
    const d = new Date(now);
    const diff = (dow - d.getDay() + 7) % 7 || 7;
    return toISODate(new Date(now + diff * 86400000));
  };
  await db.events.bulkAdd([
    { id: uid(), date: nextDow(5), title: "Dinner at Marchese", occasion: "dinner" },
    { id: uid(), date: nextDow(2), title: "Client presentation", occasion: "work" },
  ]);
  await setSetting("city", { name: "Vienna", country: "Austria", lat: 48.21, lon: 16.37 });
  await setSetting("favColors", ["camel", "cream", "black"]);
  await setSetting("dna", dna);
  await setSetting("demo", true);
  done++;
  onProgress?.({ done, total, label: "Done" });
}
