import { quote, QuoteError } from "../../public/assets/pricing.js";
import { json, fail, readJson, clean, newId, normalizePhone, validEmail } from "../_lib/http.js";
import { addDays, bookableRange, isDate, openSlots, planDays, fmtTime } from "../_lib/schedule.js";
import { closures, loadTaken } from "../_lib/calendar.js";
import { drivingMiles, chargeDeposit, refundDeposit, sendEmail, ServiceError } from "../_lib/services.js";
import { customerConfirmation, ownerNotice } from "../_lib/emails.js";

// POST a booking: re-prices the job on the server, checks the time is still
// open, charges the 10% deposit through Square, then confirms.
export async function onRequestPost({ request, env, waitUntil }) {
  const b = await readJson(request);
  if (!b) return fail("Something went wrong. Refresh the page and try again.");

  const name = clean(b.name, 100);
  const email = clean(b.email, 200).toLowerCase();
  const phone = normalizePhone(b.phone);
  const address = clean(b.address, 200);
  const vehicle = clean(b.vehicle, 200);
  const notes = clean(b.notes, 1000);
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((k) => typeof k === "string" && k.startsWith("uploads/")).slice(0, 8);
  if (!name) return fail("Enter your name.");
  if (!validEmail(email)) return fail("Enter a valid email address.");
  if (phone.length !== 10) return fail("Enter a 10-digit phone number.");
  if (address.length < 8) return fail("Enter the full address where we'll do the work.");
  if (!b.sourceId && env.FAKE_PAYMENTS !== "1") return fail("Enter your card details.");
  const idem = clean(b.idempotencyKey, 64);
  if (idem.length < 16) return fail("Something went wrong. Refresh the page and try again.");

  const date = b.date;
  const start = Number(b.start);
  const range = bookableRange();
  if (!isDate(date) || date < range.first || date > range.last) return fail("Pick a date from the calendar.");

  let q, place;
  try {
    q = quote(b.job, 0);
    place = await drivingMiles(env, address);
    q = quote(b.job, place.miles);
  } catch (e) {
    if (e instanceof QuoteError || e instanceof ServiceError) return fail(e.message);
    throw e;
  }

  const db = env.DB;
  const { isClosed } = await closures(db, date, addDays(date, 30));
  const days = planDays(date, start, q.minutes, isClosed);
  if (!days) return fail("That time doesn't work for this job. Pick another time.", 409);
  const lastDay = days[days.length - 1].date;
  const taken = await loadTaken(db, date, lastDay);
  if (!openSlots(date, q.minutes, taken, isClosed).includes(start)) {
    return fail("Someone just took that time. Pick another one.", 409);
  }

  const id = newId("WS-");
  const job = b.job.kind === "auto"
    ? { kind: "auto", service: b.job.service, level: b.job.level, size: b.job.size, polish: !!b.job.polish, ceramic: b.job.ceramic || null, addons: b.job.addons || [] }
    : { kind: "boat", length: Math.round(b.job.length), beam: Math.round(b.job.beam), services: b.job.services };
  const row = {
    id, kind: job.kind, service: job.service || null, level: job.level || null, size: job.size || null,
    job_json: JSON.stringify(job), summary: q.summary, items_json: JSON.stringify(q.items),
    service_cents: q.serviceCents, travel_cents: q.travelCents, total_cents: q.totalCents, deposit_cents: q.depositCents,
    minutes: q.minutes, date, start_min: start, name, email, phone, address: place.address, miles: place.miles,
    vehicle, notes, photos_json: JSON.stringify(photos),
  };
  const cols = Object.keys(row);
  await db.batch([
    db.prepare(`INSERT INTO bookings (${cols.join(",")}) VALUES (${cols.map((_, i) => "?" + (i + 1)).join(",")})`).bind(...Object.values(row)),
    ...days.map((d) => db.prepare(`INSERT INTO booking_days (booking_id, date, start_min, end_min) VALUES (?1, ?2, ?3, ?4)`).bind(id, d.date, d.start, d.end)),
  ]);

  const release = () => db.batch([
    db.prepare(`DELETE FROM booking_days WHERE booking_id = ?1`).bind(id),
    db.prepare(`DELETE FROM bookings WHERE id = ?1`).bind(id),
  ]);

  // Re-check after holding the time, in case two people booked at once.
  const recheck = await loadTaken(db, date, lastDay, id);
  if (!openSlots(date, q.minutes, recheck, isClosed).includes(start)) {
    await release();
    return fail("Someone just took that time. Pick another one.", 409);
  }

  let payment;
  try {
    payment = await chargeDeposit(env, {
      sourceId: b.sourceId, cents: q.depositCents, idempotencyKey: idem, email, referenceId: id,
      note: `Deposit ${id}: ${q.summary}, ${date} ${fmtTime(start)}`,
    });
  } catch (e) {
    await release();
    if (e instanceof ServiceError) return fail(e.message, 402);
    throw e;
  }

  try {
    await db.prepare(`UPDATE bookings SET status='confirmed', payment_id=?2, receipt_url=?3 WHERE id=?1`).bind(id, payment.id, payment.receiptUrl).run();
  } catch (e) {
    await refundDeposit(env, { paymentId: payment.id, cents: q.depositCents, reason: "Booking could not be saved" });
    await release().catch(() => {});
    throw e;
  }

  const saved = { ...row, status: "confirmed" };
  const site = new URL(request.url).origin;
  const c = customerConfirmation(saved);
  const o = ownerNotice(saved, site);
  waitUntil(Promise.all([
    sendEmail(env, { to: email, ...c }),
    sendEmail(env, { to: env.OWNER_EMAIL, replyTo: email, ...o }),
  ]));

  return json({
    id, date, start, time: fmtTime(start), summary: q.summary, items: q.items, miles: place.miles, address: place.address,
    travelCents: q.travelCents, totalCents: q.totalCents, depositCents: q.depositCents, receiptUrl: payment.receiptUrl,
  });
}
