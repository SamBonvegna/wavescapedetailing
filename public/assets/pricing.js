// Wave Scape pricing and job-length rules.
// Shared by the website (instant quotes) and the server (the price actually charged),
// so the two can never disagree. All money is handled in whole cents.

export const BASE_ADDRESS = "19 Hope Rd, Cranston, RI";

// Sedan prices in dollars.
export const AUTO_PRICES = {
  int: { basic: 150, select: 225 },
  ext: { basic: 100, select: 150 },
  full: { basic: 225, select: 350 },
};

export const SERVICE_NAMES = { int: "Interior", ext: "Exterior", full: "Full detail" };
export const LEVEL_NAMES = { basic: "Basic", select: "Select" };

// SUV is 15% over sedan; truck is a further 10% over SUV.
export const SIZE_MULT = { sedan: 1, suv: 1.15, truck: 1.15 * 1.1 };
export const SIZE_NAMES = { sedan: "Sedan", suv: "SUV", truck: "Truck" };

export const POLISH = 300; // sedan, scales by size
export const CERAMIC = { 3: 200, 5: 250, 10: 300 }; // sedan, scales by size
export const ADDONS = {
  pet: { name: "Pet hair removal", price: 75 },
  engine: { name: "Engine bay detail", price: 75 },
  headlight: { name: "Headlight restoration", price: 125 },
};

// Boats: dollars per square foot, where area = length x beam.
export const BOAT_RATES = {
  wash: { name: "Wash & wax", rate: 1.25 },
  polish: { name: "Polish", rate: 6 },
  ceramic: { name: "Ceramic coating", rate: 15 },
};
export const BOAT_LIMITS = { minLength: 10, maxLength: 200, minBeam: 4, maxBeam: 40 };

// Monthly Select memberships (sedan), scale by size.
export const MEMBERSHIPS = {
  ext: { name: "Exterior membership", price: 75 },
  int: { name: "Interior membership", price: 75 },
  full: { name: "Full membership", price: 120 },
};

export const DEPOSIT_RATE = 0.1;

// Job lengths in minutes, used to block the calendar.
export const AUTO_MINUTES = {
  int: { basic: 120, select: 180 },
  ext: { basic: 90, select: 150 },
  full: { basic: 210, select: 300 },
};
export const EXTRA_MINUTES = { polish: 180, ceramic: 120, pet: 30, engine: 30, headlight: 45 };
// Boat hours per 100 sq ft for each service.
export const BOAT_HOURS_PER_100SQFT = { wash: 1, polish: 3, ceramic: 2 };

/** Round a dollar amount to the nearest $5. */
export function round5(n) {
  return Math.round(n / 5 + 1e-9) * 5;
}

export function sized(dollars, size) {
  return round5(dollars * SIZE_MULT[size]);
}

/** Travel fee in dollars: free to 5 mi, $20 to 10 mi, then $1 per mile past 10. */
export function travelFee(miles) {
  if (!(miles >= 0)) return 0;
  if (miles <= 5) return 0;
  if (miles <= 10) return 20;
  return 20 + Math.round(miles - 10);
}

export function canAddPaintWork(service, level) {
  return level === "select" && (service === "ext" || service === "full");
}

/** Which Select details unlock which membership. Full unlocks all three. */
export function membershipUnlockedBy(plan, service, level) {
  if (level !== "select") return false;
  if (service === "full") return true;
  return plan === service;
}

export function membershipPrice(plan, size) {
  return sized(MEMBERSHIPS[plan].price, size);
}

export class QuoteError extends Error {}

/**
 * Price a job. Throws QuoteError on invalid input.
 * auto: { kind:"auto", service, level, size, polish, ceramic (3|5|10|null), addons:[] }
 * boat: { kind:"boat", length, beam, services:["wash"|"polish"|"ceramic"] }
 * Returns { items:[{label, cents}], serviceCents, travelCents, totalCents, depositCents, minutes, summary }
 */
export function quote(job, miles = 0) {
  const items = [];
  let minutes = 0;
  let summary;

  if (job.kind === "auto") {
    const { service, level, size } = job;
    if (!AUTO_PRICES[service]) throw new QuoteError("Pick interior, exterior or full detail.");
    if (!AUTO_PRICES[service][level]) throw new QuoteError("Pick Basic or Select.");
    if (!SIZE_MULT[size]) throw new QuoteError("Pick sedan, SUV or truck.");
    const paint = canAddPaintWork(service, level);
    if (job.polish && !paint) throw new QuoteError("Polish is only available with a Select Exterior or Select Full Detail.");
    if (job.ceramic && !paint) throw new QuoteError("Ceramic coating is only available with a Select Exterior or Select Full Detail.");
    if (job.ceramic && !CERAMIC[job.ceramic]) throw new QuoteError("Pick a 3, 5 or 10 year coating.");

    summary = `${LEVEL_NAMES[level]} ${SERVICE_NAMES[service].toLowerCase()} · ${SIZE_NAMES[size]}`;
    items.push({ label: `${LEVEL_NAMES[level]} ${SERVICE_NAMES[service].toLowerCase()} (${SIZE_NAMES[size]})`, cents: sized(AUTO_PRICES[service][level], size) * 100 });
    minutes += AUTO_MINUTES[service][level];
    if (job.polish) {
      items.push({ label: "Paint polish", cents: sized(POLISH, size) * 100 });
      minutes += EXTRA_MINUTES.polish;
    }
    if (job.ceramic) {
      items.push({ label: `${job.ceramic}-year ceramic coating`, cents: sized(CERAMIC[job.ceramic], size) * 100 });
      minutes += EXTRA_MINUTES.ceramic;
    }
    for (const id of new Set(job.addons || [])) {
      const a = ADDONS[id];
      if (!a) throw new QuoteError("Unknown add-on.");
      items.push({ label: a.name, cents: a.price * 100 });
      minutes += EXTRA_MINUTES[id];
    }
  } else if (job.kind === "boat") {
    const length = Math.round(Number(job.length));
    const beam = Math.round(Number(job.beam));
    const L = BOAT_LIMITS;
    if (!(length >= L.minLength && length <= L.maxLength)) throw new QuoteError(`Boat length must be ${L.minLength} to ${L.maxLength} ft.`);
    if (!(beam >= L.minBeam && beam <= L.maxBeam)) throw new QuoteError(`Beam must be ${L.minBeam} to ${L.maxBeam} ft.`);
    const services = [...new Set(job.services || [])];
    if (!services.length) throw new QuoteError("Pick at least one boat service.");
    const area = length * beam;
    summary = `Boat · ${length} ft × ${beam} ft (${area.toLocaleString("en-US")} sq ft)`;
    for (const id of services) {
      const s = BOAT_RATES[id];
      if (!s) throw new QuoteError("Unknown boat service.");
      items.push({ label: `${s.name} (${area.toLocaleString("en-US")} sq ft)`, cents: round5(area * s.rate) * 100 });
      minutes += Math.round((area / 100) * BOAT_HOURS_PER_100SQFT[id] * 60);
    }
    minutes = Math.max(60, Math.ceil(minutes / 30) * 30);
  } else {
    throw new QuoteError("Pick a car or a boat.");
  }

  const serviceCents = items.reduce((t, i) => t + i.cents, 0);
  const travelCents = travelFee(miles) * 100;
  const totalCents = serviceCents + travelCents;
  const depositCents = Math.round(totalCents * DEPOSIT_RATE);
  return { items, serviceCents, travelCents, totalCents, depositCents, minutes, summary };
}

export function money(cents) {
  const d = cents / 100;
  return "$" + d.toLocaleString("en-US", { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
