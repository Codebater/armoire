import type { City, DayForecast, WeatherNow } from "./types";

export async function geocodeCity(q: string): Promise<City[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  return (data.results ?? []).map((r: { name: string; country?: string; latitude: number; longitude: number }) => ({
    name: r.name,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export interface WeatherBundle {
  now: WeatherNow;
  days: DayForecast[];
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherBundle> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather failed");
  const d = await res.json();
  const days: DayForecast[] = (d.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    tempMaxC: d.daily.temperature_2m_max[i],
    tempMinC: d.daily.temperature_2m_min[i],
    precipProb: d.daily.precipitation_probability_max?.[i] ?? 0,
    code: d.daily.weather_code?.[i] ?? 0,
  }));
  const now: WeatherNow = {
    tempC: d.current?.temperature_2m ?? days[0]?.tempMaxC ?? 18,
    feelsC: d.current?.apparent_temperature ?? d.current?.temperature_2m ?? 18,
    code: d.current?.weather_code ?? 0,
    precipProb: days[0]?.precipProb ?? 0,
    tempMaxC: days[0]?.tempMaxC ?? 20,
    tempMinC: days[0]?.tempMinC ?? 12,
  };
  return { now, days };
}

export type WxIcon = "sun" | "cloud" | "rain" | "snow" | "storm" | "fog";

export function codeIcon(code: number): WxIcon {
  if ([0, 1].includes(code)) return "sun";
  if ([2, 3].includes(code)) return "cloud";
  if ([45, 48].includes(code)) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}

export function codeLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if (code >= 95) return "Thunderstorm";
  if (code >= 71 && code <= 86) return "Snow";
  if (code >= 51 && code <= 57) return "Drizzle";
  return "Rain";
}
