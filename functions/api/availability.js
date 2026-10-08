import { json, fail } from "../_lib/http.js";
import { addDays, bookableRange, isDate, openSlots, fmtTime, MAX_DAYS_AHEAD } from "../_lib/schedule.js";
import { closures, loadTaken } from "../_lib/calendar.js";

// GET ?start=YYYY-MM-DD&days=14&minutes=180 -> open start times per day.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const minutes = Number(url.searchParams.get("minutes"));
  if (!(minutes >= 30 && minutes <= 60 * 8 * 20)) return fail("Missing job length.");
  const range = bookableRange();
  let start = url.searchParams.get("start") || range.first;
  if (!isDate(start)) return fail("Bad start date.");
  if (start < range.first) start = range.first;
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 14, 1), 31);

  const end = addDays(start, days - 1);
  const db = env.DB;
  const { reason, isClosed } = await closures(db, start, end);
  const taken = await loadTaken(db, start, addDays(end, 30));

  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    if (date > range.last) break;
    const closed = reason(date);
    const slots = closed ? [] : openSlots(date, minutes, taken, isClosed);
    out.push({ date, closed, slots: slots.map((m) => ({ start: m, label: fmtTime(m) })) });
  }
  return json({ first: range.first, last: range.last, maxDaysAhead: MAX_DAYS_AHEAD, days: out });
}
