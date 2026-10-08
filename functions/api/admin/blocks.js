import { json, fail, readJson, clean } from "../../_lib/http.js";
import { isDate, todayEastern } from "../../_lib/schedule.js";

// Days the owner closes the calendar (vacations, weather, personal days).
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`SELECT date, reason FROM blocks WHERE date >= ?1 ORDER BY date`).bind(todayEastern()).all();
  return json({ blocks: results });
}

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  if (!isDate(b?.date)) return fail("Pick a date.");
  await env.DB.prepare(`INSERT INTO blocks (date, reason) VALUES (?1, ?2) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason`)
    .bind(b.date, clean(b.reason, 100) || "Closed").run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const date = new URL(request.url).searchParams.get("date");
  if (!isDate(date)) return fail("Pick a date.");
  await env.DB.prepare(`DELETE FROM blocks WHERE date = ?1`).bind(date).run();
  return json({ ok: true });
}
