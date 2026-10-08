import { addDays, holidayName } from "./schedule.js";

/** Booked time per day between two dates (inclusive), from active bookings. */
export async function loadTaken(db, from, to, excludeId = null) {
  const { results } = await db
    .prepare(
      `SELECT d.date, d.start_min, d.end_min FROM booking_days d
       JOIN bookings b ON b.id = d.booking_id
       WHERE d.date BETWEEN ?1 AND ?2 AND b.status IN ('pending','confirmed') AND b.id IS NOT ?3`
    )
    .bind(from, to, excludeId)
    .all();
  const taken = new Map();
  for (const r of results) {
    if (!taken.has(r.date)) taken.set(r.date, []);
    taken.get(r.date).push({ start: r.start_min, end: r.end_min });
  }
  return taken;
}

export async function loadBlocks(db, from, to) {
  const { results } = await db.prepare(`SELECT date, reason FROM blocks WHERE date BETWEEN ?1 AND ?2`).bind(from, to).all();
  return new Map(results.map((r) => [r.date, r.reason || "Closed"]));
}

/** Returns a closed-reason lookup for a date window (holidays + owner blocks). */
export async function closures(db, from, to) {
  const blocks = await loadBlocks(db, from, addDays(to, 30));
  const reason = (date) => holidayName(date) || blocks.get(date) || null;
  return { reason, isClosed: (date) => reason(date) !== null };
}
