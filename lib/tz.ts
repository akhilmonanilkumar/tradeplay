/**
 * The trader's timezone (set from their profile; default Asia/Kolkata).
 * Every "today", plan date, news time and custom window in the app is interpreted in this zone.
 */
let TZ = "Asia/Kolkata";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setTimeZone(tz: string | null | undefined) {
  if (tz && isValidTimeZone(tz)) TZ = tz;
}
export function getTimeZone(): string {
  return TZ;
}

/** Minutes east of UTC for `tz` at instant `d` (DST-aware). */
export function tzOffsetMin(d: Date = new Date(), tz: string = TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Wall-clock Date shifted so getUTC* fields read local time in `tz`. */
export function wall(d: Date = new Date(), tz: string = TZ): Date {
  return new Date(d.getTime() + tzOffsetMin(d, tz) * 60000);
}

/** UTC instant for a local wall-clock date "YYYY-MM-DD" + "HH:MM" in `tz`. */
export function localToUtc(date: string, hm: string, tz: string = TZ): number {
  const guess = Date.parse(`${date}T${hm.slice(0, 5)}:00Z`);
  const off1 = tzOffsetMin(new Date(guess), tz);
  const t = guess - off1 * 60000;
  const off2 = tzOffsetMin(new Date(t), tz);
  return off2 === off1 ? t : guess - off2 * 60000;
}

/** Short zone label, e.g. IST, GMT+1, EDT. */
export function tzAbbr(d: Date = new Date(), tz: string = TZ): string {
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IST";
  if (tz === "UTC" || tz === "Etc/UTC") return "UTC";
  const name = (loc: string) =>
    new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
  const us = name("en-US");
  if (us && !/^GMT/.test(us)) return us;
  const gb = name("en-GB");
  return gb && !/^GMT[+-]/.test(gb) ? gb : us || "local";
}

/** A short curated list for the profile picker (any IANA zone also works). */
export const COMMON_ZONES = [
  "Asia/Kolkata", "UTC", "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Singapore", "Asia/Hong_Kong",
  "Asia/Tokyo", "Australia/Sydney", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Sao_Paulo", "Africa/Lagos", "Africa/Johannesburg",
];
