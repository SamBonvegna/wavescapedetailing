import { json, fail, readJson } from "../../../_lib/http.js";
import { sendEmail } from "../../../_lib/services.js";
import { membershipInvite } from "../../../_lib/emails.js";

const STATUSES = ["confirmed", "completed", "cancelled"];

// POST { status } -> mark a booking completed or cancelled (or back to confirmed).
// Completing a Select auto detail emails the customer a membership invite.
export async function onRequestPost({ request, env, params, waitUntil }) {
  const body = await readJson(request);
  if (!STATUSES.includes(body?.status)) return fail("Unknown status.");
  const b = await env.DB.prepare(`SELECT * FROM bookings WHERE id = ?1`).bind(params.id).first();
  if (!b) return fail("Booking not found.", 404);
  await env.DB.prepare(`UPDATE bookings SET status = ?2 WHERE id = ?1`).bind(params.id, body.status).run();
  if (body.status === "completed" && b.status !== "completed" && b.kind === "auto" && b.level === "select") {
    waitUntil(sendEmail(env, { to: b.email, ...membershipInvite(b, new URL(request.url).origin) }));
  }
  return json({ ok: true });
}
