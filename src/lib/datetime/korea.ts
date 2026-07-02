const TZ = "Asia/Seoul";

const WEEKDAY_TO_KEY: Record<string, string> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

export function koreaDateString(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function koreaWeekdayKey(d = new Date()): string {
  const short = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
  return WEEKDAY_TO_KEY[short] ?? "mon";
}

/** "HH:MM" in Korea */
export function koreaTimeHM(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

export function koreaHourMinute(d = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

export function normalizeTimeToHM(t: string): string {
  const s = t.slice(0, 5);
  return s.length === 5 ? s : t;
}

export function koreaTimeTotalMinutes(d = new Date()): number {
  const { hour, minute } = koreaHourMinute(d);
  return hour * 60 + minute;
}

export function hmToTotalMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
