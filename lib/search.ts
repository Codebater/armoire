import { COLOR_NAMES } from "./colors";
import type { Item, Kind, Occasion, Season, StyleTag } from "./types";
import { OCCASIONS, SEASONS, STYLES } from "./types";

export interface ParsedQuery {
  colors: string[];
  kinds: Kind[];
  seasons: Season[];
  occasions: Occasion[];
  styles: StyleTag[];
  unworn: boolean;
  text: string[];
}

const KIND_WORDS: Record<string, Kind> = {
  top: "top", tops: "top", tee: "top", tshirt: "top", shirt: "top", blouse: "top",
  blouses: "top", knit: "top", sweater: "top", sweaters: "top",
  bottom: "bottom", bottoms: "bottom", pants: "bottom", trousers: "bottom",
  jeans: "bottom", skirt: "bottom", skirts: "bottom", shorts: "bottom",
  dress: "dress", dresses: "dress", gown: "dress",
  jacket: "outer", jackets: "outer", coat: "outer", coats: "outer", blazer: "outer",
  blazers: "outer", layer: "outer", layers: "outer", cardigan: "outer",
  shoe: "shoes", shoes: "shoes", sneaker: "shoes", sneakers: "shoes", heel: "shoes",
  heels: "shoes", boot: "shoes", boots: "shoes", loafer: "shoes", loafers: "shoes", sandals: "shoes",
  bag: "bag", bags: "bag", tote: "bag", purse: "bag", clutch: "bag",
  accessory: "accessory", accessories: "accessory", scarf: "accessory", belt: "accessory",
  jewellery: "accessory", jewelry: "accessory", hat: "accessory",
};

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { colors: [], kinds: [], seasons: [], occasions: [], styles: [], unworn: false, text: [] };
  const tokens = q.toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
  for (const t of tokens) {
    if (COLOR_NAMES.includes(t)) { out.colors.push(t); continue; }
    if (KIND_WORDS[t]) {
      if (!out.kinds.includes(KIND_WORDS[t])) out.kinds.push(KIND_WORDS[t]);
      // Specific garment words also narrow by name (jeans ≠ every bottom).
      if (!["top","tops","bottom","bottoms","dress","dresses","shoe","shoes","bag","bags","accessory","accessories","layer","layers"].includes(t)) {
        out.text.push(t.replace(/s$/, ""));
      }
      continue;
    }
    if ((SEASONS as string[]).includes(t)) { out.seasons.push(t as Season); continue; }
    if ((OCCASIONS as string[]).includes(t)) { out.occasions.push(t as Occasion); continue; }
    if ((STYLES as string[]).includes(t)) { out.styles.push(t as StyleTag); continue; }
    if (t === "unworn" || t === "new") { out.unworn = true; continue; }
    if (t.length > 1) out.text.push(t);
  }
  return out;
}

export function matchItem(item: Item, p: ParsedQuery, wearCount?: number): boolean {
  if (p.colors.length && !p.colors.some((c) => item.colors.includes(c))) return false;
  if (p.kinds.length && !p.kinds.includes(item.kind)) return false;
  if (p.seasons.length && !p.seasons.some((s) => item.seasons.includes(s))) return false;
  if (p.occasions.length && !p.occasions.some((o) => item.occasions.includes(o))) return false;
  if (p.styles.length && !p.styles.some((s) => item.styles.includes(s))) return false;
  if (p.unworn && (wearCount ?? 0) > 0) return false;
  if (p.text.length) {
    const hay = `${item.name} ${item.brand ?? ""} ${item.notes ?? ""}`.toLowerCase();
    if (!p.text.every((t) => hay.includes(t))) return false;
  }
  return true;
}
