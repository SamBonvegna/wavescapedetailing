// Outside services: Google Maps (distance), Square (deposits), Resend (email).
// Each one has a local-testing switch so the site can run without real keys.

import { BASE_ADDRESS } from "../../public/assets/pricing.js";

export class ServiceError extends Error {}

/** Driving miles from the Cranston home base to an address. */
export async function drivingMiles(env, address) {
  if (env.FAKE_MILES !== undefined && env.FAKE_MILES !== "") {
    return { miles: Number(env.FAKE_MILES), address };
  }
  if (!env.GOOGLE_MAPS_API_KEY) throw new ServiceError("Address lookup isn't set up yet. Please call or text us to book.");
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", env.BASE_ADDRESS || BASE_ADDRESS);
  url.searchParams.set("destinations", address);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const el = data?.rows?.[0]?.elements?.[0];
  if (data.status !== "OK" || el?.status !== "OK") {
    throw new ServiceError("We couldn't find that address. Check the street, city and ZIP code.");
  }
  return {
    miles: Math.round((el.distance.value / 1609.344) * 10) / 10,
    address: data.destination_addresses?.[0] || address,
  };
}

function squareBase(env) {
  return env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

/** Charge the booking deposit with a card token from the Square Web Payments SDK. */
export async function chargeDeposit(env, { sourceId, cents, idempotencyKey, note, email, referenceId }) {
  if (env.FAKE_PAYMENTS === "1") return { id: "FAKE-" + idempotencyKey.slice(0, 8), receiptUrl: null };
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) throw new ServiceError("Online payments aren't set up yet. Please call or text us to book.");
  const res = await fetch(squareBase(env) + "/v2/payments", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      "content-type": "application/json",
      "square-version": "2024-10-17",
    },
    body: JSON.stringify({
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: { amount: cents, currency: "USD" },
      location_id: env.SQUARE_LOCATION_ID,
      autocomplete: true,
      note: note.slice(0, 500),
      reference_id: referenceId,
      buyer_email_address: email,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.payment) {
    const detail = data?.errors?.[0]?.code;
    const message = {
      CARD_DECLINED: "Your card was declined. Try another card.",
      CVV_FAILURE: "The security code didn't match. Check it and try again.",
      ADDRESS_VERIFICATION_FAILURE: "The ZIP code didn't match your card. Check it and try again.",
      INVALID_EXPIRATION: "The expiration date isn't valid.",
      INSUFFICIENT_FUNDS: "Your card was declined for insufficient funds.",
    }[detail] || "We couldn't charge your card. Try again, or call or text us.";
    throw new ServiceError(message);
  }
  return { id: data.payment.id, receiptUrl: data.payment.receipt_url || null };
}

/** Refund a deposit (used if the booking can't be saved after charging). */
export async function refundDeposit(env, { paymentId, cents, reason }) {
  if (env.FAKE_PAYMENTS === "1" || !env.SQUARE_ACCESS_TOKEN) return;
  await fetch(squareBase(env) + "/v2/refunds", {
    method: "POST",
    headers: { authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`, "content-type": "application/json", "square-version": "2024-10-17" },
    body: JSON.stringify({ idempotency_key: crypto.randomUUID(), payment_id: paymentId, amount_money: { amount: cents, currency: "USD" }, reason }),
  });
}

/** Send an email through Resend. Quietly skips when email isn't configured. */
export async function sendEmail(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !to) {
    console.log(`[email skipped] to=${to} subject=${subject}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html, reply_to: replyTo || env.OWNER_EMAIL || undefined }),
  });
  if (!res.ok) console.log(`[email failed] ${res.status} ${await res.text()}`);
  return res.ok;
}
