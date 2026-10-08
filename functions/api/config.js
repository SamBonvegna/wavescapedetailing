import { json } from "../_lib/http.js";

// Public settings the booking page needs to show the Square card form.
export function onRequestGet({ env }) {
  return json({
    squareAppId: env.SQUARE_APPLICATION_ID || null,
    squareLocationId: env.SQUARE_LOCATION_ID || null,
    squareEnvironment: env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
    fakePayments: env.FAKE_PAYMENTS === "1",
  });
}
