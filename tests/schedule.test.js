import { test } from "node:test";
import assert from "node:assert/strict";
import { openSlots, planDays, holidayName, todayEastern, fmtTime, DAY_START } from "../functions/_lib/schedule.js";

const never = () => false;

test("holidays", () => {
  assert.equal(holidayName("2026-11-26"), "Thanksgiving");
  assert.equal(holidayName("2026-05-25"), "Memorial Day");
  assert.equal(holidayName("2026-09-07"), "Labor Day");
  assert.equal(holidayName("2026-04-05"), "Easter");
  assert.equal(holidayName("2026-12-25"), "Christmas Day");
  assert.equal(holidayName("2026-12-26"), null);
});

test("an empty day offers starts from 9am until the job fits before 5pm", () => {
  const s = openSlots("2026-10-20", 300, new Map(), never);
  assert.equal(s[0], 9 * 60);
  assert.equal(s[s.length - 1], 12 * 60);
});

test("existing jobs block their time plus a 30 minute travel gap", () => {
  const taken = new Map([["2026-10-20", [{ start: 9 * 60, end: 11 * 60 }]]]);
  const s = openSlots("2026-10-20", 120, taken, never);
  assert.equal(s[0], 11 * 60 + 30);
  assert.ok(!s.includes(11 * 60));
});

test("closed days have no slots", () => {
  assert.deepEqual(openSlots("2026-10-20", 60, new Map(), () => true), []);
});

test("long boat jobs span open days and skip closed ones", () => {
  const closed = (d) => d === "2026-10-21";
  const plan = planDays("2026-10-20", DAY_START, 600, closed);
  assert.deepEqual(plan, [
    { date: "2026-10-20", start: 540, end: 1020 },
    { date: "2026-10-22", start: 540, end: 660 },
  ]);
  const taken = new Map([["2026-10-22", [{ start: 600, end: 700 }]]]);
  assert.deepEqual(openSlots("2026-10-20", 600, taken, closed), []);
});

test("eastern date and time labels", () => {
  assert.equal(todayEastern(new Date("2026-10-09T03:00:00Z")), "2026-10-08");
  assert.equal(fmtTime(9 * 60), "9:00 AM");
  assert.equal(fmtTime(12 * 60 + 30), "12:30 PM");
});
