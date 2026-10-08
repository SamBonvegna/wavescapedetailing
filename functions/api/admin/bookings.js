import { json } from "../../_lib/http.js";
import { addDays, todayEastern } from "../../_lib/schedule.js";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD -> bookings in that window (default: last 7 days to +60).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const today = todayEastern();
  const from = url.searchParams.get("from") || addDays(today, -7);
  const to = url.searchParams.get("to") || addDays(today, 60);
  const { results } = await env.DB.prepare(
    `SELECT * FROM bookings WHERE date BETWEEN ?1 AND ?2 AND status != 'pending' ORDER BY date, start_min`
  ).bind(from, to).all();
  return json({ from, to, bookings: results });
}
