"use client";

import { useEffect, useState } from "react";
import { COLOR_DEFS } from "@/lib/colors";
import { db, wipeAll } from "@/lib/db";
import { useDebounced, useSetting } from "@/lib/hooks";
import type { City } from "@/lib/types";
import { geocodeCity } from "@/lib/weather";
import { Field, Sheet, inputCls, useToast } from "./ui";
import clsx from "clsx";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [city, setCity] = useSetting<City | null>("city", null);
  const [favColors, setFavColors] = useSetting<string[]>("favColors", []);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [results, setResults] = useState<City[]>([]);
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    geocodeCity(dq)
      .then((r) => !cancel && setResults(r))
      .catch(() => !cancel && setResults([]));
    return () => {
      cancel = true;
    };
  }, [dq]);

  const toggleFav = (name: string) => {
    if (favColors.includes(name)) setFavColors(favColors.filter((c) => c !== name));
    else if (favColors.length < 4) setFavColors([...favColors, name]);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Preferences">
      <div className="space-y-6">
        <Field label="Your city — for weather-aware styling">
          <input
            className={inputCls}
            placeholder={city ? `${city.name}${city.country ? ", " + city.country : ""}` : "Search a city…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
              {results.map((r, i) => (
                <button
                  key={`${r.name}-${i}`}
                  className="block w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-linefaint"
                  onClick={() => {
                    setCity(r);
                    setQ("");
                    setResults([]);
                    toast(`Weather set to ${r.name}`);
                  }}
                >
                  {r.name}
                  <span className="text-muted"> · {r.country}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="mt-2 text-[12.5px] font-medium text-accent underline-offset-2 hover:underline"
            onClick={() => {
              if (!navigator.geolocation) return toast("Location unavailable");
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setCity({ name: "My location", lat: p.coords.latitude, lon: p.coords.longitude });
                  toast("Using your location");
                },
                () => toast("Location denied — search a city instead"),
                { timeout: 8000 },
              );
            }}
          >
            Use my current location
          </button>
        </Field>

        <div>
          <span className="micro mb-2 block text-muted">Favourite colours (up to 4)</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_DEFS.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => toggleFav(c.name)}
                className={clsx(
                  "h-8 w-8 rounded-full border-2 transition-transform active:scale-90",
                  favColors.includes(c.name) ? "border-ink scale-105" : "border-ink/10",
                )}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="micro mb-2 block text-clay">Danger zone</span>
          {!confirmErase ? (
            <button className="text-[13.5px] font-medium text-clay underline-offset-2 hover:underline" onClick={() => setConfirmErase(true)}>
              Erase all wardrobe data…
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted">Everything will be gone. Sure?</span>
              <button
                className="rounded-full bg-clay px-3.5 py-1.5 text-[12.5px] font-semibold text-card"
                onClick={async () => {
                  await wipeAll();
                  setConfirmErase(false);
                  onClose();
                  toast("Wardrobe erased");
                }}
              >
                Erase
              </button>
              <button className="btn-ghost px-3.5 py-1.5 text-[12.5px]" onClick={() => setConfirmErase(false)}>
                Keep
              </button>
            </div>
          )}
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Everything lives in this browser (IndexedDB) — no account, no cloud. AI tagging uses your
            optional API key on the server route only.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

export async function closetIsEmpty(): Promise<boolean> {
  return (await db.items.count()) === 0;
}
