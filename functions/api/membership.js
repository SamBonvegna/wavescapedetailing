import { MEMBERSHIPS, SIZE_NAMES, membershipPrice, membershipUnlockedBy } from "../../public/assets/pricing.js";
import { json, fail, readJson, clean, newId, normalizePhone, validEmail } from "../_lib/http.js";
import { sendEmail } from "../_lib/services.js";
import { membershipNotice } from "../_lib/emails.js";

// POST { plan, size, name, email, phone } -> checks the customer has had the
// matching completed Select detail, then records the request for the owner.
export async function onRequestPost({ request, env, waitUntil }) {
  const b = await readJson(request);
  const plan = b?.plan, size = b?.size;
  if (!MEMBERSHIPS[plan]) return fail("Pick a membership.");
  if (!SIZE_NAMES[size]) return fail("Pick sedan, SUV or truck.");
  const name = clean(b.name, 100), email = clean(b.email, 200).toLowerCase(), phone = normalizePhone(b.phone);
  if (!name) return fail("Enter your name.");
  if (!validEmail(email)) return fail("Enter a valid email address.");
  if (phone.length !== 10) return fail("Enter a 10-digit phone number.");

  const { results } = await env.DB.prepare(
    `SELECT id, service, level FROM bookings WHERE status='completed' AND kind='auto' AND (email=?1 OR phone=?2) ORDER BY date DESC`
  ).bind(email, phone).all();
  const unlock = results.find((r) => membershipUnlockedBy(plan, r.service, r.level));
  if (!unlock) {
    const need = plan === "full" ? "a Select Full Detail" : `a Select ${plan === "ext" ? "Exterior" : "Interior"} or Select Full Detail`;
    return fail(`This membership opens up after ${need}. Use the same email or phone you booked with, or book that detail first.`, 403);
  }

  const m = { id: newId("M-"), plan, size, price_cents: membershipPrice(plan, size) * 100, name, email, phone, booking_id: unlock.id };
  await env.DB.prepare(
    `INSERT INTO membership_requests (id, plan, size, price_cents, name, email, phone, booking_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
  ).bind(m.id, m.plan, m.size, m.price_cents, m.name, m.email, m.phone, m.booking_id).run();

  const notice = membershipNotice({ ...m, planName: MEMBERSHIPS[plan].name, sizeName: SIZE_NAMES[size] });
  waitUntil(sendEmail(env, { to: env.OWNER_EMAIL, replyTo: email, ...notice }));
  return json({ ok: true, priceCents: m.price_cents });
}
