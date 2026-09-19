"use client";

import { useEffect, useState } from "react";
import { useSetting } from "@/lib/hooks";
import type { City } from "@/lib/types";
import { fetchWeather, type WeatherBundle } from "@/lib/weather";

export type WeatherStatus = "loading" | "ok" | "nocity" | "error";

export function useWeather(): {
  weather: WeatherBundle | null;
  city: City | null;
  status: WeatherStatus;
  setCity: (c: City | null) => void;
} {
  const [city, setCity] = useSetting<City | null>("city", null);
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // No unsolicited geolocation prompt — the user sets a city (or taps
      // "use my location" in preferences, which asks with a real gesture).
      const lat: number | undefined = city?.lat;
      const lon: number | undefined = city?.lon;
      if (lat === undefined || lon === undefined) {
        if (!cancelled) {
          setWeather(null);
          setStatus("nocity");
        }
        return;
      }
      try {
        const w = await fetchWeather(lat, lon);
        if (!cancelled) {
          setWeather(w);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
          setStatus("error");
        }
      }
    }
    setStatus("loading");
    void run();
    return () => {
      cancelled = true;
    };
  }, [city?.lat, city?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  return { weather, city: city ?? null, status, setCity };
}
