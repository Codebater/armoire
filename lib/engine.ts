import { outfitHarmony } from "./colors";
import { outfitHash } from "./db";
import type { Item, ItemAttrs, Occasion, Season, StyleDNA } from "./types";
import { EMPTY_DNA } from "./types";

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface EngineCtx {
  occasion?: Occasion;
  weather?: { tempC: number; precipProb: number } | null;
  todayISO: string;
  season: Season;
  lastWorn: Map<string, string>; // itemId -> last ISO date
  wearCounts: Map<string, number>;
  recentHashes: Set<string>; // outfit hashes worn/planned in the last 14 days
  favColors: string[];
  dna: StyleDNA;
}

export function defaultCtx(todayISO: string, season: Season): EngineCtx {
  return {
    todayISO,
    season,
    lastWorn: new Map(),
    wearCounts: new Map(),
    recentHashes: new Set(),
    favColors: [],
    dna: EMPTY_DNA,
    weather: null,
  };
}

/** Convenience: rotation maps derived from wear history. */
export function wearMaps(
  wears: { itemIds: string[]; date: string; outfitHash: string }[],
  todayIso: string,
): Pick<EngineCtx, "lastWorn" | "wearCounts" | "recentHashes"> {
  const lastWorn = new Map<string, string>();
  const wearCounts = new Map<string, number>();
  const recentHashes = new Set<string>();
  const today = new Date(todayIso + "T12:00:00").getTime();
  for (const w of wears) {
    for (const id of w.itemIds) {
      wearCounts.set(id, (wearCounts.get(id) ?? 0) + 1);
      const prev = lastWorn.get(id);
      if (!prev || prev < w.date) lastWorn.set(id, w.date);
    }
    const age = (today - new Date(w.date + "T12:00:00").getTime()) / 86400000;
    if (age <= 14) recentHashes.add(w.outfitHash);
  }
  return { lastWorn, wearCounts, recentHashes };
}

export function seasonFor(date: Date, lat?: number): Season {
  const m = date.getMonth(); // 0..11
  const north: Season[] = [
    "winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "autumn", "autumn", "autumn", "winter",
  ];
  let s = north[m];
  if (lat !== undefined && lat < 0) {
    const flip: Record<Season, Season> = {
      winter: "summer",
      summer: "winter",
      spring: "autumn",
      autumn: "spring",
    };
    s = flip[s];
  }
  return s;
}

export function targetWarmth(tempC: number): number {
  if (tempC >= 26) return 0;
  if (tempC >= 19) return 1;
  if (tempC >= 11) return 2;
  return 3;
}

const OCCASION_BAND: Record<Occasion, [number, number]> = {
  casual: [0, 2],
  travel: [0, 2],
  sport: [0, 1],
  work: [2, 3],
  dinner: [2, 4],
  party: [2, 4],
  formal: [3, 4],
};

/* ------------------------------------------------------------------ */
/* Look + scoring                                                      */
/* ------------------------------------------------------------------ */

export interface Look {
  top?: Item;
  bottom?: Item;
  dress?: Item;
  shoes?: Item;
  outer?: Item;
  bag?: Item;
}

export interface ScoredLook extends Look {
  items: Item[];
  hash: string;
  score: number;
  reasons: string[];
}

function lookItems(l: Look): Item[] {
  return [l.dress, l.top, l.bottom, l.outer, l.shoes, l.bag].filter(Boolean) as Item[];
}

interface Part {
  pts: number;
  reason?: string;
}

export function scoreLook(look: Look, ctx: EngineCtx): { score: number; reasons: string[] } {
  const items = lookItems(look);
  if (items.length === 0) return { score: 0, reasons: [] };
  const parts: Part[] = [];

  // 1 — color chemistry (the heart of "does this go together").
  const mainPieces = [look.dress, look.top, look.bottom, look.outer, look.shoes].filter(Boolean) as Item[];
  const harmony = outfitHarmony(mainPieces.map((i) => i.colors));
  parts.push({ pts: harmony.pts, reason: harmony.tag ?? undefined });

  // 2 — dress code.
  if (ctx.occasion) {
    const [lo, hi] = OCCASION_BAND[ctx.occasion];
    let off = 0;
    for (const i of mainPieces) {
      if (i.formality < lo - 1 || i.formality > hi + 1) off++;
    }
    const tagged = mainPieces.filter((i) => i.occasions.includes(ctx.occasion!)).length;
    if (off === 0) parts.push({ pts: 8, reason: `right for ${ctx.occasion}` });
    else parts.push({ pts: -6 * off, reason: `off dress code` });
    if (tagged >= Math.min(2, mainPieces.length)) parts.push({ pts: 4 });
  }

  // 3 — weather.
  if (ctx.weather) {
    const target = targetWarmth(ctx.weather.tempC);
    const core = look.dress
      ? look.dress.warmth
      : Math.round(((look.top?.warmth ?? 1) + (look.bottom?.warmth ?? 1)) / 2);
    const effective = Math.min(3, core + (look.outer ? 1 : 0));
    const diff = Math.abs(target - effective);
    if (diff === 0) parts.push({ pts: 10, reason: `made for ${Math.round(ctx.weather.tempC)}°` });
    else if (diff === 1) parts.push({ pts: 3 });
    else parts.push({ pts: -8 * (diff - 1), reason: target > effective ? "too light for today" : "too warm for today" });
    if (ctx.weather.precipProb > 55 && look.shoes && look.shoes.warmth === 0 && look.shoes.formality >= 3) {
      parts.push({ pts: -4, reason: "rain likely" });
    }
  }

  // 4 — season tags.
  let offSeason = 0;
  for (const i of mainPieces) {
    if (i.seasons.length && !i.seasons.includes(ctx.season)) offSeason++;
  }
  if (offSeason === 0) parts.push({ pts: 5 });
  else parts.push({ pts: -4 * Math.min(2, offSeason), reason: "out of season" });

  // 5 — freshness (rotation).
  let fresh = 0;
  let stale = false;
  for (const i of items) {
    const last = ctx.lastWorn.get(i.id);
    if (!last) {
      fresh += 2;
      continue;
    }
    const days = Math.round(
      (new Date(ctx.todayISO + "T12:00:00").getTime() - new Date(last + "T12:00:00").getTime()) / 86400000,
    );
    if (days < 2) {
      fresh -= 7;
      stale = true;
    } else if (days < 6) fresh -= 2;
    else if (days > 30) fresh += 2;
  }
  fresh = Math.max(-14, Math.min(6, fresh));
  parts.push({ pts: fresh, reason: stale ? "worn very recently" : fresh >= 4 ? "fresh rotation" : undefined });
  const hash = outfitHash(items.map((i) => i.id));
  if (ctx.recentHashes.has(hash)) parts.push({ pts: -14, reason: "repeat of a recent look" });

  // 6 — closet love.
  const debut = items.filter((i) => !ctx.wearCounts.get(i.id)).length;
  if (debut > 0) parts.push({ pts: Math.min(4, debut * 2), reason: debut ? "gives a neglected piece its debut" : undefined });
  const favHits = mainPieces.filter((i) => i.colors[0] && ctx.favColors.includes(i.colors[0])).length;
  if (favHits) parts.push({ pts: 4, reason: "your favourite colours" });
  const favItems = items.filter((i) => i.fav).length;
  if (favItems) parts.push({ pts: Math.min(3, favItems) });

  // 7 — learned taste (style DNA).
  let dnaPts = 0;
  for (let i = 0; i < mainPieces.length; i++) {
    for (let j = i + 1; j < mainPieces.length; j++) {
      const key = [mainPieces[i].colors[0], mainPieces[j].colors[0]].sort().join("|");
      if ((ctx.dna.pairs[key] ?? 0) >= 2) dnaPts += 2;
    }
  }
  const topStyles = Object.entries(ctx.dna.styles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);
  if (topStyles.length && mainPieces.some((i) => i.styles.some((s) => topStyles.includes(s)))) dnaPts += 3;
  if (dnaPts) parts.push({ pts: Math.min(8, dnaPts), reason: "very you" });

  // 8 — style coherence: sporty sneakers under a gown reads off.
  const spread =
    Math.max(...mainPieces.map((i) => i.formality)) - Math.min(...mainPieces.map((i) => i.formality));
  if (spread >= 3) parts.push({ pts: -6, reason: "formality clash" });
  else if (spread <= 1 && mainPieces.length >= 3) parts.push({ pts: 3 });

  const raw = 46 + parts.reduce((s, p) => s + p.pts, 0);
  const score = Math.max(3, Math.min(99, Math.round(raw)));
  const reasons = parts
    .filter((p) => p.reason)
    .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
    .slice(0, 3)
    .map((p) => p.reason!) as string[];
  return { score, reasons };
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface GenOptions {
  n?: number;
  mode?: "auto" | "separates" | "dress";
  lock?: Partial<Look>;
  minScore?: number;
  /** Sampling cap for very large closets. */
  cap?: number;
}

function pools(items: Item[]) {
  const av = items.filter((i) => !i.laundry);
  return {
    tops: av.filter((i) => i.kind === "top"),
    bottoms: av.filter((i) => i.kind === "bottom"),
    dresses: av.filter((i) => i.kind === "dress"),
    shoes: av.filter((i) => i.kind === "shoes"),
    outers: av.filter((i) => i.kind === "outer"),
    bags: av.filter((i) => i.kind === "bag"),
  };
}

function toScored(look: Look, ctx: EngineCtx): ScoredLook {
  const { score, reasons } = scoreLook(look, ctx);
  const items = lookItems(look);
  return { ...look, items, hash: outfitHash(items.map((i) => i.id)), score, reasons };
}

/** Enumerate candidate looks (bounded), scored and sorted. */
export function enumerateLooks(items: Item[], ctx: EngineCtx, opts: GenOptions = {}): ScoredLook[] {
  const { tops, bottoms, dresses, shoes, outers, bags } = pools(items);
  const lock = opts.lock ?? {};
  const cap = opts.cap ?? 900;
  const shoePool = lock.shoes ? [lock.shoes] : shoes.length ? shoes : [undefined];
  const out: ScoredLook[] = [];
  const cold = ctx.weather ? targetWarmth(ctx.weather.tempC) >= 2 : false;
  const outerPool = lock.outer ? [lock.outer] : outers;
  const bagPool = lock.bag ? [lock.bag] : bags;

  const pushLook = (base: Look) => {
    let best = toScored(base, ctx);
    // Try layering when it's cold (or a layer is locked).
    if ((cold || lock.outer) && outerPool.length) {
      for (const o of outerPool.slice(0, 6)) {
        const s = toScored({ ...base, outer: o }, ctx);
        if (s.score > best.score || lock.outer) best = s;
      }
    }
    // Attach the best bag if it helps (small closets: cheap).
    if (bagPool.length) {
      const withBag = bagPool
        .slice(0, 4)
        .map((b) => toScored({ ...best, bag: b }, ctx))
        .sort((a, b) => b.score - a.score)[0];
      if (withBag && withBag.score >= best.score) best = withBag;
    }
    out.push(best);
  };

  const wantSeparates = opts.mode !== "dress" && !lock.dress;
  const wantDress = opts.mode !== "separates" && !lock.top && !lock.bottom && dresses.length > 0;

  if (wantSeparates) {
    const tPool = lock.top ? [lock.top] : tops;
    const bPool = lock.bottom ? [lock.bottom] : bottoms;
    const pairs: [Item, Item][] = [];
    for (const t of tPool) for (const b of bPool) pairs.push([t, b]);
    let chosen = pairs;
    if (pairs.length * shoePool.length > cap) {
      chosen = [...pairs].sort(() => Math.random() - 0.5).slice(0, Math.max(40, Math.floor(cap / shoePool.length)));
    }
    for (const [t, b] of chosen) {
      for (const s of shoePool) pushLook({ top: t, bottom: b, shoes: s ?? undefined });
    }
  }
  if (wantDress) {
    const dPool = lock.dress ? [lock.dress] : dresses;
    for (const d of dPool) for (const s of shoePool) pushLook({ dress: d, shoes: s ?? undefined });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Top-n diverse looks (no near-duplicates, avoids recent repeats). */
export function genLooks(items: Item[], ctx: EngineCtx, opts: GenOptions = {}): ScoredLook[] {
  const n = opts.n ?? 4;
  const all = enumerateLooks(items, ctx, opts);
  const picked: ScoredLook[] = [];
  const seen = new Set<string>();
  const overlapOk = (l: ScoredLook) => {
    for (const p of picked) {
      const shared = l.items.filter((i) => p.items.some((pi) => pi.id === i.id)).length;
      if (shared > Math.min(l.items.length, p.items.length) - 2) return false;
    }
    return true;
  };
  for (const pass of [0, 1]) {
    for (const l of all) {
      if (picked.length >= n) break;
      if (seen.has(l.hash)) continue;
      if (pass === 0 && ctx.recentHashes.has(l.hash)) continue;
      if (pass === 0 && !overlapOk(l)) continue;
      picked.push(l);
      seen.add(l.hash);
    }
    if (picked.length >= n) break;
  }
  return picked;
}

/* ------------------------------------------------------------------ */
/* Analysis: versatility, gaps, capsule, packing, wishlist              */
/* ------------------------------------------------------------------ */

export function versatilityMap(items: Item[], ctx: EngineCtx, min = 68): Map<string, number> {
  const neutral: EngineCtx = { ...ctx, weather: null, occasion: undefined, recentHashes: new Set() };
  const all = enumerateLooks(items, neutral, { cap: 2200 });
  const map = new Map<string, number>();
  for (const l of all) {
    if (l.score < min) continue;
    for (const i of l.items) map.set(i.id, (map.get(i.id) ?? 0) + 1);
  }
  return map;
}

export function makeVirtualItem(attrs: ItemAttrs, id = "virtual"): Item {
  return {
    ...attrs,
    id,
    fav: 0,
    laundry: 0,
    createdAt: 0,
    image: undefined as unknown as Blob,
    thumb: undefined as unknown as Blob,
  };
}

export interface GapSuggestion {
  attrs: ItemAttrs;
  unlocked: number;
  bestWith: Item[];
}

const ARCHETYPES: ItemAttrs[] = [
  { kind: "top", name: "White blouse", colors: ["white"], styles: ["classic", "elegant"], seasons: ["spring", "summer", "autumn", "winter"], occasions: ["work", "dinner", "casual"], warmth: 1, formality: 3 },
  { kind: "bottom", name: "Black tailored trousers", colors: ["black"], styles: ["classic", "minimal"], seasons: ["spring", "summer", "autumn", "winter"], occasions: ["work", "dinner", "formal"], warmth: 1, formality: 3 },
  { kind: "bottom", name: "Dark denim jeans", colors: ["denim"], styles: ["classic", "street"], seasons: ["spring", "autumn", "winter"], occasions: ["casual", "travel"], warmth: 2, formality: 1 },
  { kind: "shoes", name: "White leather sneakers", colors: ["white"], styles: ["minimal", "street"], seasons: ["spring", "summer", "autumn"], occasions: ["casual", "travel", "work"], warmth: 1, formality: 1 },
  { kind: "dress", name: "Little black dress", colors: ["black"], styles: ["elegant", "classic"], seasons: ["spring", "summer", "autumn", "winter"], occasions: ["dinner", "party", "formal"], warmth: 1, formality: 4 },
  { kind: "top", name: "Camel fine knit", colors: ["camel"], styles: ["minimal", "classic"], seasons: ["autumn", "winter", "spring"], occasions: ["casual", "work"], warmth: 2, formality: 2 },
  { kind: "outer", name: "Navy blazer", colors: ["navy"], styles: ["classic", "preppy"], seasons: ["spring", "autumn", "winter"], occasions: ["work", "dinner"], warmth: 2, formality: 3 },
  { kind: "shoes", name: "Black ankle boots", colors: ["black"], styles: ["classic", "edgy"], seasons: ["autumn", "winter"], occasions: ["casual", "work", "dinner"], warmth: 2, formality: 2 },
  { kind: "bottom", name: "Cream midi skirt", colors: ["cream"], styles: ["romantic", "elegant"], seasons: ["spring", "summer"], occasions: ["dinner", "casual", "work"], warmth: 1, formality: 3 },
  { kind: "top", name: "Striped breton top", colors: ["navy"], styles: ["preppy", "classic"], seasons: ["spring", "summer"], occasions: ["casual", "travel"], warmth: 1, formality: 1 },
];

export function gapSuggestions(items: Item[], ctx: EngineCtx, min = 70): GapSuggestion[] {
  const neutral: EngineCtx = { ...ctx, weather: null, occasion: undefined, recentHashes: new Set() };
  const out: GapSuggestion[] = [];
  for (const a of ARCHETYPES) {
    const similar = items.some(
      (i) => i.kind === a.kind && i.colors[0] === a.colors[0] && Math.abs(i.formality - a.formality) <= 1,
    );
    if (similar) continue;
    const v = makeVirtualItem(a);
    const withV = [...items, v];
    const lock: Partial<Look> = { [a.kind === "shoes" ? "shoes" : a.kind]: v } as Partial<Look>;
    const looks = enumerateLooks(withV, neutral, { lock, cap: 700 }).filter((l) => l.score >= min);
    const bestWith = looks
      .slice(0, 3)
      .flatMap((l) => l.items)
      .filter((i) => i.id !== "virtual")
      .filter((i, idx, arr) => arr.findIndex((x) => x.id === i.id) === idx)
      .slice(0, 3);
    if (looks.length > 0) out.push({ attrs: a, unlocked: looks.length, bestWith });
  }
  return out.sort((a, b) => b.unlocked - a.unlocked).slice(0, 4);
}

export interface CapsuleResult {
  items: Item[];
  lookCount: number;
  sample: ScoredLook[];
}

export function buildCapsule(items: Item[], ctx: EngineCtx, size: number): CapsuleResult {
  const neutral: EngineCtx = { ...ctx, weather: null, occasion: undefined, recentHashes: new Set() };
  const v = versatilityMap(items, neutral, 64);
  const av = items.filter((i) => !i.laundry);
  const byV = (arr: Item[]) => [...arr].sort((a, b) => (v.get(b.id) ?? 0) - (v.get(a.id) ?? 0));
  const quota: [Item["kind"], number][] = [
    ["top", Math.max(2, Math.round(size * 0.34))],
    ["bottom", Math.max(2, Math.round(size * 0.27))],
    ["dress", Math.round(size * 0.08)],
    ["outer", Math.max(1, Math.round(size * 0.12))],
    ["shoes", Math.max(1, Math.round(size * 0.15))],
    ["bag", Math.round(size * 0.04)],
  ];
  let chosen: Item[] = [];
  for (const [kind, n] of quota) {
    chosen = chosen.concat(byV(av.filter((i) => i.kind === kind)).slice(0, n));
  }
  chosen = chosen.slice(0, size);
  const looks = enumerateLooks(chosen, neutral, { cap: 1500 }).filter((l) => l.score >= 64);
  const uniq = new Set(looks.map((l) => l.hash));
  return { items: chosen, lookCount: uniq.size, sample: looks.slice(0, 4) };
}

export interface PackingResult {
  items: Item[];
  days: { date: string; look: ScoredLook }[];
  byKind: [string, Item[]][];
}

export function packForTrip(
  items: Item[],
  ctx: EngineCtx,
  dates: string[],
  occasions: Occasion[],
  tempC: number | null,
): PackingResult | null {
  const base: EngineCtx = {
    ...ctx,
    weather: tempC === null ? null : { tempC, precipProb: 30 },
    recentHashes: new Set(),
  };
  const all = enumerateLooks(items, base, { cap: 2000 }).filter((l) => l.score >= 55);
  if (!all.length) return null;
  const picked: ScoredLook[] = [];
  const union = new Set<string>();
  for (let d = 0; d < dates.length; d++) {
    const occ = occasions.length ? occasions[d % occasions.length] : undefined;
    const scored = all
      .filter((l) => !picked.includes(l))
      .map((l) => {
        const newItems = l.items.filter((i) => !union.has(i.id)).length;
        const occFit = occ ? (l.items.filter((i) => i.occasions.includes(occ)).length >= 2 ? 8 : -6) : 0;
        return { l, val: l.score + occFit - 9 * newItems };
      })
      .sort((a, b) => b.val - a.val);
    const best = scored[0]?.l;
    if (!best) break;
    picked.push(best);
    best.items.forEach((i) => union.add(i.id));
  }
  const packed = items.filter((i) => union.has(i.id));
  const kinds: Item["kind"][] = ["top", "bottom", "dress", "outer", "shoes", "bag", "accessory"];
  const byKind = kinds
    .map((k) => [k, packed.filter((i) => i.kind === k)] as [string, Item[]])
    .filter(([, arr]) => arr.length > 0);
  return { items: packed, days: dates.map((date, i) => ({ date, look: picked[Math.min(i, picked.length - 1)] })), byKind };
}

export interface WishMatch {
  pairsWith: number;
  unlocked: number;
  best: ScoredLook[];
}

export function wishlistMatch(attrs: ItemAttrs, items: Item[], ctx: EngineCtx, min = 68): WishMatch {
  const neutral: EngineCtx = { ...ctx, weather: null, occasion: undefined, recentHashes: new Set() };
  const v = makeVirtualItem(attrs, "wish");
  const slot = (attrs.kind === "accessory" || attrs.kind === "bag" ? "bag" : attrs.kind) as keyof Look;
  const lock = { [slot]: v } as Partial<Look>;
  const looks = enumerateLooks([...items, v], neutral, { lock, cap: 800 }).filter((l) => l.score >= min);
  const partners = new Set<string>();
  for (const l of looks) for (const i of l.items) if (i.id !== "wish") partners.add(i.id);
  return { pairsWith: partners.size, unlocked: looks.length, best: looks.slice(0, 3) };
}
