export function fmtMoney(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `€${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dayName(iso: string, len: "short" | "long" = "short"): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: len });
}

export function relDays(iso: string, todayIso: string): string {
  const a = new Date(iso + "T12:00:00").getTime();
  const b = new Date(todayIso + "T12:00:00").getTime();
  const diff = Math.round((b - a) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.round(diff / 7)}w ago`;
  return `${Math.round(diff / 30)}mo ago`;
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? one + "s"}`;
}
