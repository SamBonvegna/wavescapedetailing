import { quote, QuoteError } from "../../public/assets/pricing.js";
import { json, fail, readJson, clean } from "../_lib/http.js";
import { drivingMiles, ServiceError } from "../_lib/services.js";

// POST { job, address } -> price including the travel fee for that address.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body?.job) return fail("Missing job details.");
  const address = clean(body.address, 200);
  if (address.length < 8) return fail("Enter the full address where we'll do the work.");
  try {
    quote(body.job, 0); // validate before spending a Maps lookup
    const place = await drivingMiles(env, address);
    return json({ miles: place.miles, address: place.address, quote: quote(body.job, place.miles) });
  } catch (e) {
    if (e instanceof QuoteError || e instanceof ServiceError) return fail(e.message);
    throw e;
  }
}
