import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, travelFee, sized, membershipPrice, membershipUnlockedBy, QuoteError } from "../public/assets/pricing.js";

const auto = (o) => ({ kind: "auto", service: "full", level: "select", size: "sedan", polish: false, ceramic: null, addons: [], ...o });

test("sedan menu prices", () => {
  const p = (service, level) => quote(auto({ service, level })).serviceCents / 100;
  assert.equal(p("int", "basic"), 150);
  assert.equal(p("int", "select"), 225);
  assert.equal(p("ext", "basic"), 100);
  assert.equal(p("ext", "select"), 150);
  assert.equal(p("full", "basic"), 225);
  assert.equal(p("full", "select"), 350);
});

test("full detail is cheaper than interior + exterior", () => {
  for (const level of ["basic", "select"]) for (const size of ["sedan", "suv", "truck"]) {
    const s = (service) => quote(auto({ service, level, size })).serviceCents;
    assert.ok(s("full") < s("int") + s("ext"), `${level} ${size}`);
  }
});

test("SUV +15%, truck +10% on top, rounded to $5", () => {
  assert.equal(sized(350, "suv"), 405); // 402.50
  assert.equal(sized(350, "truck"), 445); // 442.75
  assert.equal(sized(300, "suv"), 345);
  assert.equal(sized(300, "truck"), 380); // 379.50
  assert.equal(sized(250, "suv"), 290);
});

test("polish and ceramic only with Select exterior or full", () => {
  assert.throws(() => quote(auto({ service: "int", polish: true })), QuoteError);
  assert.throws(() => quote(auto({ level: "basic", ceramic: 5 })), QuoteError);
  const q = quote(auto({ service: "ext", polish: true, ceramic: 5, size: "suv", addons: ["pet", "pet", "headlight"] }));
  assert.deepEqual(q.items.map((i) => i.cents / 100), [175, 345, 290, 75, 125]);
});

test("travel fee tiers", () => {
  assert.equal(travelFee(0), 0);
  assert.equal(travelFee(5), 0);
  assert.equal(travelFee(5.1), 20);
  assert.equal(travelFee(10), 20);
  assert.equal(travelFee(14), 24);
  assert.equal(travelFee(14.4), 24);
});

test("deposit is 10% of the total including travel", () => {
  const q = quote(auto({}), 8);
  assert.equal(q.totalCents, 37000);
  assert.equal(q.depositCents, 3700);
});

test("boats are priced per square foot", () => {
  const q = quote({ kind: "boat", length: 24, beam: 8, services: ["wash", "polish", "ceramic"] });
  assert.deepEqual(q.items.map((i) => i.cents / 100), [240, 1150, 2880]);
  assert.throws(() => quote({ kind: "boat", length: 300, beam: 8, services: ["wash"] }), QuoteError);
  assert.throws(() => quote({ kind: "boat", length: 24, beam: 8, services: [] }), QuoteError);
});

test("memberships", () => {
  assert.equal(membershipPrice("full", "sedan"), 120);
  assert.equal(membershipPrice("ext", "suv"), 85);
  assert.equal(membershipPrice("ext", "truck"), 95);
  assert.equal(membershipPrice("full", "truck"), 150);
  assert.ok(membershipUnlockedBy("ext", "full", "select"));
  assert.ok(membershipUnlockedBy("int", "int", "select"));
  assert.ok(!membershipUnlockedBy("int", "ext", "select"));
  assert.ok(!membershipUnlockedBy("full", "ext", "select"));
  assert.ok(!membershipUnlockedBy("ext", "full", "basic"));
});
