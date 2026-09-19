# ARMOIRE — your digital wardrobe

A luxury-minimal wardrobe app: photograph your clothes, they get cut out and tagged,
then Armoire styles them into outfits — swipeable top/bottom/shoes bands composing one
picture (yes, like *Clueless*), scored for color harmony, weather, dress code and rotation.

## Run

```bash
npm install
npm run dev        # http://localhost:3985
```

Everything is **local-first**: items, images, looks, wear history and plans live in the
browser's IndexedDB. No account, no cloud.

## Optional AI tagging

Copy `.env.example` → `.env.local` and set `ANTHROPIC_API_KEY` to have Claude vision
pre-fill category/colors/style/season/occasion on upload. Without a key the app still
works: colors are detected locally and you confirm tags in the review step.

## Features

- **Add** — multi-photo upload, on-device background removal (~40 MB model, first use only),
  auto color detection, AI or manual tagging, warmth/formality dials, price for cost-per-wear.
- **Studio (main screen)** — swipe top / bottom / shoes independently, lock slots, add a
  layer & bag, live match score with reasons, shuffle, save, "worn today".
  **Dress me today** proposes 3–5 looks from weather (Open-Meteo), today's calendar events,
  your favorite colors and what you wore recently.
- **Closet** — grid with search ("black dress", "work winter", "unworn"), kind/color filters,
  laundry state, wishlist with *pairs-with/unlocks* purchase preview, capsule builder.
- **Looks** — saved looks, 7-day planner with per-day forecast + events + auto-plan, wear history.
- **Insights** — most/least worn, cost per wear, color balance closet-vs-worn, seasonal usage,
  versatility ranking, wardrobe gap suggestions, learned Style DNA.
- **Pack** — destination + dates + agenda → minimal case with day-by-day outfits and checklist.

## Stack

Next.js 16 · React 19 · Tailwind 4 · motion · Dexie (IndexedDB) · @imgly/background-removal
(on-device) · Open-Meteo (keyless weather/geocoding) · optional Anthropic API route.
