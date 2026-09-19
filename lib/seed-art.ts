/**
 * Procedural garment art for the demo closet — elegant flat-lay style
 * SVG silhouettes rasterized to transparent PNGs entirely client-side.
 */

export type Shape =
  | "tee" | "knit" | "turtleneck" | "blouse" | "blazer" | "denimjacket" | "coat"
  | "trousers" | "jeans" | "wideleg" | "skirt" | "mini" | "pleated"
  | "slip" | "dressa"
  | "sneaker" | "heel" | "boot"
  | "tote" | "crossbody" | "scarf" | "beltcoil";

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(hex: string, target: number, amt: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const m = (c: number) => clamp(c + (target - c) * amt).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}

const darken = (hex: string, amt: number) => mix(hex, 0, amt);
const lighten = (hex: string, amt: number) => mix(hex, 255, amt);

function luma(hex: string): number {
  const h = hex.replace("#", "");
  return (
    (0.2126 * parseInt(h.slice(0, 2), 16) +
      0.7152 * parseInt(h.slice(2, 4), 16) +
      0.0722 * parseInt(h.slice(4, 6), 16)) /
    255
  );
}

interface Pal {
  fill: string; // gradient url
  hi: string;
  lo: string;
  line: string; // seam/detail color
  lineFaint: string;
}

function defs(hex: string, id: string): { defs: string; pal: Pal } {
  const dark = luma(hex) < 0.28;
  const line = dark ? lighten(hex, 0.34) : darken(hex, 0.34);
  return {
    defs: `<linearGradient id="${id}" x1="0" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="${lighten(hex, 0.10)}"/>
      <stop offset="0.55" stop-color="${hex}"/>
      <stop offset="1" stop-color="${darken(hex, 0.14)}"/>
    </linearGradient>`,
    pal: {
      fill: `url(#${id})`,
      hi: lighten(hex, 0.22),
      lo: darken(hex, 0.2),
      line,
      lineFaint: line,
    },
  };
}

function plaidGroup(clipId: string, dark: boolean): string {
  const a = dark ? "rgba(255,255,255,0.16)" : "rgba(30,25,15,0.20)";
  const b = dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.35)";
  let bars = "";
  for (let x = 40; x < 480; x += 58) {
    bars += `<rect x="${x}" y="0" width="14" height="480" fill="${a}"/><rect x="${x + 22}" y="0" width="3" height="480" fill="${b}"/>`;
  }
  for (let y = 30; y < 480; y += 58) {
    bars += `<rect x="0" y="${y}" width="480" height="14" fill="${a}"/><rect x="0" y="${y + 22}" width="480" height="3" fill="${b}"/>`;
  }
  return `<g clip-path="url(#${clipId})">${bars}</g>`;
}

function ribs(x: number, y: number, w: number, h: number, color: string, step = 7): string {
  let s = "";
  for (let i = x + 3; i < x + w - 2; i += step) {
    s += `<line x1="${i}" y1="${y + 1}" x2="${i}" y2="${y + h - 1}" stroke="${color}" stroke-opacity="0.35" stroke-width="1.6"/>`;
  }
  return s;
}

type GarmentFn = (p: Pal, o: { plaid?: boolean; denim?: boolean; clip: (path: string) => string }) => string;

const S = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const L = (d: string, stroke: string, w = 2.4, op = 0.5, extra = "") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;

/* ---------------------------------------------------------------- */

const TEE_BODY =
  "M150 106 Q240 74 330 106 L398 172 L358 220 L303 188 L310 396 Q240 412 170 396 L177 188 L122 220 L82 172 Z";

const tee: GarmentFn = (p, o) =>
  S(TEE_BODY, p.fill) +
  o.clip(TEE_BODY) +
  S("M203 98 Q240 128 277 98 Q240 112 203 98", p.lo, `opacity="0.85"`) +
  L("M203 98 Q240 86 277 98", p.line, 3, 0.6) +
  L("M177 188 L122 218", p.line, 2, 0.35) +
  L("M303 188 L358 218", p.line, 2, 0.35) +
  L("M172 392 Q240 406 308 392", p.line, 2, 0.35);

const KNIT_BODY =
  "M152 112 Q240 82 328 112 L382 152 L400 330 L346 342 L318 200 L312 392 Q240 408 168 392 L162 200 L134 342 L80 330 L98 152 Z";

function knitBase(p: Pal, o: { clip: (path: string) => string }, collar: "crew" | "turtle" | "vee"): string {
  let s = S(KNIT_BODY, p.fill) + o.clip(KNIT_BODY);
  if (collar === "turtle") {
    s += `<rect x="206" y="58" width="68" height="52" rx="12" fill="${p.fill}"/>` + ribs(206, 58, 68, 52, p.line);
    s += L("M206 108 Q240 122 274 108", p.line, 3, 0.55);
  } else if (collar === "vee") {
    s += S("M208 104 L240 160 L272 104 L240 118 Z", p.lo, `opacity="0.8"`);
  } else {
    s += S("M204 102 Q240 130 276 102 Q240 116 204 102", p.lo, `opacity="0.85"`) + L("M204 102 Q240 90 276 102", p.line, 3.4, 0.6);
  }
  // cuffs + hem ribbing
  s += ribs(76, 318, 60, 26, p.line) + ribs(344, 318, 60, 26, p.line) + ribs(170, 378, 140, 26, p.line, 9);
  s += L("M162 200 L136 336", p.line, 2, 0.3) + L("M318 200 L344 336", p.line, 2, 0.3);
  return s;
}

const knit: GarmentFn = (p, o) => knitBase(p, o, "crew");
const turtleneck: GarmentFn = (p, o) => knitBase(p, o, "turtle");

const BLOUSE_BODY =
  "M156 112 Q240 86 324 112 L372 150 L386 336 L338 346 L314 208 L316 400 Q240 416 164 400 L166 208 L142 346 L94 336 L108 150 Z";

const blouse: GarmentFn = (p, o) =>
  S(BLOUSE_BODY, p.fill) +
  o.clip(BLOUSE_BODY) +
  // collar
  S("M212 100 L240 146 L268 100 L282 112 L240 168 L198 112 Z", p.lo, `opacity="0.55"`) +
  L("M240 168 L240 398", p.line, 2.2, 0.5) +
  [200, 240, 280, 320, 360].map((y) => `<circle cx="240" cy="${y}" r="3" fill="${p.line}" fill-opacity="0.75"/>`).join("") +
  // cuffs
  L("M96 328 L142 338", p.line, 2.4, 0.45) +
  L("M384 328 L338 338", p.line, 2.4, 0.45) +
  L("M168 396 Q240 410 312 396", p.line, 2, 0.35);

const BLAZER_BODY =
  "M150 116 Q240 88 330 116 L386 154 L400 348 L348 358 L320 212 L318 408 L162 408 L160 212 L132 358 L80 348 L94 154 Z";

const blazer: GarmentFn = (p, o) =>
  S(BLAZER_BODY, p.fill) +
  o.clip(BLAZER_BODY) +
  // open front
  S("M240 132 L206 408 L240 408 L274 408 Z", p.lo, `opacity="0.9"`) +
  // lapels
  S("M240 132 L196 118 L216 210 L240 260 Z", p.hi, `opacity="0.28"`) +
  S("M240 132 L284 118 L264 210 L240 260 Z", p.hi, `opacity="0.28"`) +
  L("M196 118 L216 210 L240 260", p.line, 2.6, 0.55) +
  L("M284 118 L264 210 L240 260", p.line, 2.6, 0.55) +
  `<circle cx="252" cy="292" r="4" fill="${p.line}" fill-opacity="0.8"/>` +
  // pockets
  L("M176 320 L214 322", p.line, 3, 0.5) +
  L("M266 322 L304 320", p.line, 3, 0.5) +
  L("M160 212 L134 348", p.line, 2, 0.3) +
  L("M320 212 L346 348", p.line, 2, 0.3);

const DJ_BODY =
  "M152 118 Q240 92 328 118 L380 156 L396 330 L344 340 L318 206 L314 356 Q240 368 166 356 L162 206 L136 340 L84 330 L100 156 Z";

const denimjacket: GarmentFn = (p, o) => {
  const stitch = "#C9A469";
  return (
    S(DJ_BODY, p.fill) +
    o.clip(DJ_BODY) +
    S("M240 134 L214 356 L240 358 L266 356 Z", p.lo, `opacity="0.85"`) +
    S("M212 108 L240 134 L216 172 L196 122 Z", p.hi, `opacity="0.3"`) +
    S("M268 108 L240 134 L264 172 L284 122 Z", p.hi, `opacity="0.3"`) +
    L("M176 200 L216 204", stitch, 2, 0.8) + L("M264 204 L304 200", stitch, 2, 0.8) +
    `<rect x="178" y="206" width="36" height="30" rx="4" fill="none" stroke="${stitch}" stroke-opacity="0.7" stroke-width="2"/>` +
    `<rect x="266" y="206" width="36" height="30" rx="4" fill="none" stroke="${stitch}" stroke-opacity="0.7" stroke-width="2"/>` +
    L("M168 344 Q240 356 312 344", stitch, 2.2, 0.8) +
    L("M162 206 L138 336", stitch, 1.8, 0.6) + L("M318 206 L342 336", stitch, 1.8, 0.6) +
    [258, 262].map((x) => `<circle cx="${x - 6}" cy="286" r="3.4" fill="${stitch}"/>`).join("")
  );
};

const COAT_BODY =
  "M152 114 Q240 86 328 114 L384 152 L398 356 L348 366 L322 214 L326 446 L154 446 L158 214 L132 366 L82 356 L96 152 Z";

const coat: GarmentFn = (p, o) =>
  S(COAT_BODY, p.fill) +
  o.clip(COAT_BODY) +
  S("M240 130 L216 446 L240 446 L264 446 Z", p.lo, `opacity="0.85"`) +
  S("M240 130 L198 116 L222 214 L240 262 Z", p.hi, `opacity="0.26"`) +
  S("M240 130 L282 116 L258 214 L240 262 Z", p.hi, `opacity="0.26"`) +
  L("M198 116 L222 214 L240 262", p.line, 2.6, 0.5) +
  L("M282 116 L258 214 L240 262", p.line, 2.6, 0.5) +
  `<rect x="158" y="268" width="164" height="26" rx="6" fill="${p.lo}" opacity="0.55"/>` +
  `<rect x="224" y="264" width="34" height="34" rx="6" fill="none" stroke="${p.line}" stroke-opacity="0.7" stroke-width="3"/>` +
  L("M170 330 L206 332", p.line, 3, 0.45) +
  L("M274 332 L310 330", p.line, 3, 0.45);

const TROUSER_BODY = "M172 96 L308 96 L324 434 L258 438 L241 212 L222 438 L156 434 Z";

const trousers: GarmentFn = (p, o) =>
  S(TROUSER_BODY, p.fill) +
  o.clip(TROUSER_BODY) +
  `<rect x="172" y="96" width="136" height="24" rx="4" fill="${p.lo}" opacity="0.5"/>` +
  `<rect x="230" y="102" width="20" height="12" rx="3" fill="none" stroke="${p.line}" stroke-opacity="0.7" stroke-width="2"/>` +
  L("M198 130 Q194 280 190 428", p.line, 2, 0.28) +
  L("M282 130 Q286 280 290 428", p.line, 2, 0.28) +
  L("M240 120 L241 200", p.line, 2, 0.4);

const jeans: GarmentFn = (p, o) => {
  const stitch = "#C9A469";
  return (
    S(TROUSER_BODY, p.fill) +
    o.clip(TROUSER_BODY) +
    `<rect x="172" y="96" width="136" height="24" rx="4" fill="${p.lo}" opacity="0.55"/>` +
    L("M158 128 Q186 150 214 132", stitch, 2.2, 0.85) +
    L("M266 132 Q294 150 322 128", stitch, 2.2, 0.85) +
    L("M240 122 Q246 160 242 206", stitch, 2, 0.8) +
    L("M160 140 L157 430", stitch, 1.8, 0.7) +
    L("M320 140 L323 430", stitch, 1.8, 0.7) +
    L("M160 424 L220 430", stitch, 1.8, 0.7) +
    L("M260 430 L320 424", stitch, 1.8, 0.7) +
    `<circle cx="184" cy="112" r="3" fill="${stitch}"/>`
  );
};

const WIDE_BODY = "M176 96 L304 96 L330 438 L252 440 L243 220 L228 440 L150 438 Z";

const wideleg: GarmentFn = (p, o) =>
  S(WIDE_BODY, p.fill) +
  o.clip(WIDE_BODY) +
  `<rect x="176" y="96" width="128" height="22" rx="4" fill="${p.lo}" opacity="0.45"/>` +
  L("M196 128 L184 430", p.line, 2, 0.26) +
  L("M284 128 L296 430", p.line, 2, 0.26) +
  L("M240 118 L242 210", p.line, 2, 0.35);

const SKIRT_BODY = "M190 96 L290 96 L296 128 Q356 300 344 396 Q240 416 136 396 Q124 300 184 128 Z";

const skirt: GarmentFn = (p, o) =>
  S(SKIRT_BODY, p.fill) +
  o.clip(SKIRT_BODY) +
  `<rect x="188" y="96" width="104" height="20" rx="5" fill="${p.lo}" opacity="0.5"/>` +
  L("M186 140 Q160 280 146 386", p.line, 2, 0.25) +
  L("M294 140 Q320 280 334 386", p.line, 2, 0.25) +
  L("M140 392 Q240 410 340 392", p.line, 2.2, 0.35);

const MINI_BODY = "M186 100 L294 100 L300 130 Q330 240 322 296 Q240 314 158 296 Q150 240 180 130 Z";

const mini: GarmentFn = (p, o) =>
  S(MINI_BODY, p.fill) +
  o.clip(MINI_BODY) +
  `<rect x="184" y="100" width="112" height="20" rx="5" fill="${p.lo}" opacity="0.5"/>` +
  L("M162 292 Q240 306 318 292", p.line, 2.2, 0.4) +
  L("M182 132 L166 280", p.line, 2, 0.25) +
  L("M298 132 L314 280", p.line, 2, 0.25);

const pleated: GarmentFn = (p, o) => {
  let folds = "";
  for (let i = 0; i < 9; i++) {
    const x0 = 186 + i * 12;
    const x1 = 152 + i * 22;
    folds += L(`M${x0} 122 L${x1} 388`, i % 2 ? p.line : p.hi, 2, i % 2 ? 0.3 : 0.35);
  }
  const body = "M188 96 L292 96 L298 126 Q352 300 342 392 Q240 412 138 392 Q128 300 182 126 Z";
  return (
    S(body, p.fill) +
    o.clip(body) +
    `<rect x="186" y="96" width="108" height="20" rx="5" fill="${p.lo}" opacity="0.5"/>` +
    folds +
    L("M142 388 Q240 406 338 388", p.line, 2.2, 0.4)
  );
};

const SLIP_BODY = "M196 128 Q240 152 284 128 L302 190 Q322 320 310 424 Q240 442 170 424 Q158 320 178 190 Z";

const slip: GarmentFn = (p, o) =>
  L("M204 76 L199 132", p.line, 3, 0.7) +
  L("M276 76 L281 132", p.line, 3, 0.7) +
  S(SLIP_BODY, p.fill) +
  o.clip(SLIP_BODY) +
  L("M196 128 Q240 154 284 128", p.line, 2.6, 0.5) +
  L("M212 200 Q200 300 206 400", p.hi, 3, 0.3) +
  L("M262 220 Q272 320 266 410", p.hi, 3, 0.24) +
  L("M174 420 Q240 436 306 420", p.line, 2, 0.35);

const DRESSA_BODY =
  "M162 110 Q240 84 318 110 L354 152 L322 190 L296 172 L304 236 Q346 340 336 416 Q240 436 144 416 Q134 340 176 236 L184 172 L158 190 L126 152 Z";

const dressa: GarmentFn = (p, o) =>
  S(DRESSA_BODY, p.fill) +
  o.clip(DRESSA_BODY) +
  S("M206 102 Q240 128 274 102 Q240 114 206 102", p.lo, `opacity="0.8"`) +
  L("M184 240 Q240 252 296 240", p.line, 2.4, 0.45) +
  L("M148 410 Q240 428 332 410", p.line, 2.2, 0.35) +
  L("M196 260 Q186 340 182 402", p.line, 2, 0.2) +
  L("M284 260 Q294 340 298 402", p.line, 2, 0.2);

const sneaker: GarmentFn = (p, o) => {
  const sole = "M84 312 Q82 348 122 352 L360 352 Q398 350 396 322 L392 306 L86 300 Z";
  const upper = "M92 302 Q98 240 172 226 L268 218 Q332 214 372 260 L392 306 L86 302 Z";
  return (
    S(upper, p.fill) +
    o.clip(upper) +
    S(sole, "#EFEBE2") +
    L("M86 322 L394 326", "#B9B2A4", 2.4, 0.8) +
    S("M240 222 Q300 218 348 252 L372 300 L300 300 Q260 262 240 222 Z", p.hi, `opacity="0.25"`) +
    L("M196 232 L232 296", p.line, 2.6, 0.5) +
    L("M220 228 L256 292", p.line, 2.6, 0.5) +
    L("M246 224 L280 288", p.line, 2.6, 0.5) +
    L("M96 296 Q120 268 152 258", p.line, 2.4, 0.45) +
    `<ellipse cx="120" cy="286" rx="16" ry="8" fill="${p.lo}" opacity="0.3"/>`
  );
};

const heel: GarmentFn = (p, o) => {
  const body = "M92 300 Q150 244 224 232 Q318 220 366 250 L382 300 Q300 320 208 316 Q140 312 92 300 Z";
  return (
    S(body, p.fill) +
    o.clip(body) +
    S("M224 236 Q300 226 356 252 L338 292 Q280 274 232 254 Z", p.hi, `opacity="0.22"`) +
    S("M352 296 L344 376 L362 378 L374 300 Z", p.fill) +
    S("M88 300 L96 316 L128 318 L120 302 Z", p.lo, `opacity="0.7"`) +
    L("M92 300 Q220 330 382 300", p.line, 2.6, 0.5) +
    L("M150 262 Q210 246 268 242", p.line, 2, 0.3)
  );
};

const boot: GarmentFn = (p, o) => {
  const body =
    "M196 156 L330 156 L330 300 Q368 306 380 330 L384 356 L136 356 L136 330 Q142 306 176 300 L196 300 Z";
  return (
    S(body, p.fill) +
    o.clip(body) +
    `<rect x="196" y="148" width="134" height="16" rx="8" fill="${p.lo}" opacity="0.55"/>` +
    S("M136 356 L384 356 L382 376 Q260 388 138 376 Z", "#2A2622") +
    `<rect x="300" y="376" width="52" height="26" rx="4" fill="#2A2622"/>` +
    L("M214 170 L212 296", p.line, 2.4, 0.5) +
    L("M180 306 Q160 316 148 336", p.line, 2, 0.35) +
    `<circle cx="214" cy="304" r="3.4" fill="${p.line}" fill-opacity="0.8"/>`
  );
};

const tote: GarmentFn = (p, o) => {
  const body = "M138 186 L342 186 L336 408 Q240 424 144 408 Z";
  return (
    L("M172 186 Q172 118 218 118 Q248 118 248 178", p.line, 9, 0.9) +
    L("M232 186 Q232 118 278 118 Q308 118 308 178", p.line, 9, 0.9) +
    S(body, p.fill) +
    o.clip(body) +
    L("M150 206 L330 206", p.line, 2.4, 0.4) +
    L("M156 386 Q240 398 324 386", p.line, 2, 0.3) +
    `<rect x="222" y="248" width="36" height="22" rx="4" fill="none" stroke="${p.line}" stroke-opacity="0.6" stroke-width="2.4"/>`
  );
};

const crossbody: GarmentFn = (p, o) => {
  const body = "M166 226 L314 226 Q322 226 322 236 L318 356 Q240 370 162 356 L158 236 Q158 226 166 226 Z";
  const flap = "M162 228 L318 228 L312 292 Q240 306 168 292 Z";
  return (
    L("M176 226 Q196 96 240 88 Q284 96 304 226", p.line, 5, 0.85) +
    S(body, p.fill) +
    o.clip(body) +
    S(flap, p.lo, `opacity="0.5"`) +
    L("M168 292 Q240 306 312 292", p.line, 2.6, 0.6) +
    `<rect x="228" y="278" width="24" height="16" rx="3" fill="#C8A96A"/>` +
    L("M170 348 Q240 360 310 348", p.line, 2, 0.3)
  );
};

const scarf: GarmentFn = (p, o) => {
  const a = "M186 148 Q246 196 214 402 Q198 428 178 402 Q158 260 152 170 Q166 140 186 148 Z";
  const b = "M294 148 Q314 140 328 170 Q322 260 302 402 Q282 428 266 402 Q234 196 294 148 Z";
  return (
    S(a, p.fill) +
    S(b, p.fill) +
    o.clip(a) +
    `<ellipse cx="240" cy="146" rx="64" ry="42" fill="${p.fill}"/>` +
    L("M196 128 Q240 108 284 128", p.line, 2.4, 0.4) +
    L("M182 170 Q186 300 194 396", p.line, 2, 0.3) +
    L("M298 170 Q294 300 286 396", p.line, 2, 0.3) +
    L("M208 160 Q240 176 272 160", p.line, 2, 0.35)
  );
};

const beltcoil: GarmentFn = (p) =>
  `<circle cx="240" cy="250" r="118" fill="none" stroke="${p.fill}" stroke-width="30"/>` +
  `<circle cx="240" cy="250" r="118" fill="none" stroke="${p.line}" stroke-opacity="0.35" stroke-width="2" />` +
  `<circle cx="240" cy="250" r="132" fill="none" stroke="${p.line}" stroke-opacity="0.25" stroke-width="2" />` +
  `<rect x="216" y="104" width="48" height="34" rx="8" fill="none" stroke="#C8A96A" stroke-width="8"/>` +
  `<path d="M262 236 Q300 244 306 268 L296 282 Q262 268 250 256 Z" fill="${p.lo}" opacity="0.8"/>`;

const GARMENTS: Record<Shape, GarmentFn> = {
  tee, knit, turtleneck, blouse, blazer, denimjacket, coat,
  trousers, jeans, wideleg, skirt, mini, pleated,
  slip, dressa, sneaker, heel, boot, tote, crossbody, scarf, beltcoil,
};

let seq = 0;

export async function garmentBlob(shape: Shape, hex: string, opts: { plaid?: boolean } = {}): Promise<Blob> {
  const id = `g${++seq}`;
  const { defs: gdefs, pal } = defs(hex, id);
  const clipId = `cp${seq}`;
  let clipPath = "";
  const clip = (path: string) => {
    if (!opts.plaid) return "";
    clipPath = `<clipPath id="${clipId}"><path d="${path}"/></clipPath>`;
    return plaidGroup(clipId, luma(hex) < 0.28);
  };
  const inner = GARMENTS[shape](pal, { ...opts, clip });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="960" height="960">` +
    `<defs>${gdefs}${clipPath}</defs>${inner}</svg>`;
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg raster failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 960;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 960, 960);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png failed"))), "image/png"),
  );
}
