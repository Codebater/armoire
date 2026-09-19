export type Kind = "top" | "bottom" | "dress" | "outer" | "shoes" | "bag" | "accessory";

export type Season = "spring" | "summer" | "autumn" | "winter";

export type Occasion = "casual" | "work" | "dinner" | "party" | "formal" | "travel" | "sport";

export type StyleTag =
  | "minimal"
  | "classic"
  | "elegant"
  | "romantic"
  | "edgy"
  | "sporty"
  | "street"
  | "boho"
  | "preppy";

export const KINDS: Kind[] = ["top", "bottom", "dress", "outer", "shoes", "bag", "accessory"];
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export const OCCASIONS: Occasion[] = ["casual", "work", "dinner", "party", "formal", "travel", "sport"];
export const STYLES: StyleTag[] = [
  "minimal",
  "classic",
  "elegant",
  "romantic",
  "edgy",
  "sporty",
  "street",
  "boho",
  "preppy",
];

export const KIND_LABEL: Record<Kind, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outer: "Layers",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
};

export const KIND_ONE: Record<Kind, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outer: "Layer",
  shoes: "Shoes",
  bag: "Bag",
  accessory: "Accessory",
};

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  brand?: string;
  colors: string[]; // ColorName[]
  styles: StyleTag[];
  seasons: Season[];
  occasions: Occasion[];
  warmth: number; // 0 airy … 3 cold-weather
  formality: number; // 0 lounge … 4 black tie
  price?: number;
  notes?: string;
  fav: 0 | 1;
  laundry: 0 | 1; // 1 = in laundry / unavailable
  aiTagged?: boolean;
  bgRemoved?: boolean;
  createdAt: number;
  image: Blob; // trimmed display image (webp, alpha)
  thumb: Blob; // small webp
}

/** Attribute subset used for virtual items (wishlist previews, gap analysis). */
export type ItemAttrs = Pick<
  Item,
  "kind" | "name" | "colors" | "styles" | "seasons" | "occasions" | "warmth" | "formality"
>;

export interface Outfit {
  id: string;
  itemIds: string[];
  hash: string; // sorted ids joined with "+"
  occasion?: Occasion;
  score?: number;
  name?: string;
  fav: 0 | 1;
  createdAt: number;
}

export interface Wear {
  id: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitHash: string;
  occasion?: Occasion;
  createdAt: number;
}

export interface Plan {
  id: string;
  date: string; // YYYY-MM-DD (unique)
  itemIds: string[];
  note?: string;
}

export interface EventRec {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  occasion: Occasion;
}

export interface WishItem extends ItemAttrs {
  id: string;
  brand?: string;
  price?: number;
  url?: string;
  image?: Blob;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface City {
  name: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface WeatherNow {
  tempC: number;
  feelsC: number;
  code: number;
  precipProb: number;
  tempMaxC: number;
  tempMinC: number;
}

export interface DayForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipProb: number;
  code: number;
}

export interface StyleDNA {
  pairs: Record<string, number>; // "camel|cream" -> count
  styles: Record<string, number>; // style tag -> count
}

export const EMPTY_DNA: StyleDNA = { pairs: {}, styles: {} };
