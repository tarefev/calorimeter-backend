import { DateTime } from "luxon";

// Parse date (YYYY-MM-DD) and optional time (HH:MM:SS) in given tz (IANA) or fallback tz.
export function parseLocalToUtc(
  date: string,
  time?: string,
  tz?: string
): { utc: Date; localString?: string } {
  const timePart = time ?? "00:00:00";
  const dt = DateTime.fromISO(`${date}T${timePart}`, { zone: tz ?? "UTC" });
  return { utc: dt.toUTC().toJSDate(), localString: `${date}T${timePart}` };
}
