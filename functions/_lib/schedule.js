// Calendar rules: one tech, 9am-5pm Eastern, every day except holidays and
// days the owner blocks. Times are minutes after midnight, Eastern time.

export const TIME_ZONE = "America/New_York";
export const DAY_START = 9 * 60;
export const DAY_END = 17 * 60;
export const WORKDAY = DAY_END - DAY_START;
export const SLOT_STEP = 30;
export const TRAVEL_BUFFER = 30; // gap kept between jobs for driving
export const MIN_DAYS_AHEAD = 1; // no same-day online bookings
export const MAX_DAYS_AHEAD = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** nth weekday (0=Sun) of a month; n=-1 means last. */
function nthWeekday(y, m, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return ymd(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7));
}

function easter(y) {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

/** Holidays the business is closed. */
export function holidays(y) {
  return new Map([
    [ymd(y, 1, 1), "New Year's Day"],
    [easter(y), "Easter"],
    [nthWeekday(y, 5, 1, -1), "Memorial Day"],
    [ymd(y, 7, 4), "Independence Day"],
    [nthWeekday(y, 9, 1, 1), "Labor Day"],
    [nthWeekday(y, 11, 4, 4), "Thanksgiving"],
    [ymd(y, 12, 25), "Christmas Day"],
  ]);
}

export function holidayName(date) {
  return holidays(Number(date.slice(0, 4))).get(date) || null;
}

/** Today's date in Eastern time. */
export function todayEastern(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function bookableRange(now = new Date()) {
  const today = todayEastern(now);
  return { first: addDays(today, MIN_DAYS_AHEAD), last: addDays(today, MAX_DAYS_AHEAD) };
}

/**
 * Lay a job across the calendar. Jobs longer than a workday start at 9am and
 * continue on the following open days. Returns [{date, start, end}] or null
 * if a needed day is closed.
 */
export function planDays(date, start, minutes, isClosed) {
  if (isClosed(date)) return null;
  if (minutes <= WORKDAY) {
    if (start < DAY_START || start + minutes > DAY_END) return null;
    return [{ date, start, end: start + minutes }];
  }
  if (start !== DAY_START) return null;
  const days = [];
  let left = minutes;
  let d = date;
  for (let guard = 0; left > 0 && guard < 30; guard++) {
    if (!isClosed(d)) {
      const len = Math.min(WORKDAY, left);
      days.push({ date: d, start: DAY_START, end: DAY_START + len });
      left -= len;
    }
    d = addDays(d, 1);
  }
  return left > 0 ? null : days;
}

function clashes(day, taken) {
  return (taken.get(day.date) || []).some(
    (b) => day.start < b.end + TRAVEL_BUFFER && b.start < day.end + TRAVEL_BUFFER
  );
}

/**
 * Open start times for a job on a date.
 * taken: Map(date -> [{start, end}]) of existing bookings and partial blocks.
 * isClosed: (date) => true for holidays and blocked days.
 */
export function openSlots(date, minutes, taken, isClosed) {
  const out = [];
  const last = minutes > WORKDAY ? DAY_START : DAY_END - minutes;
  for (let s = DAY_START; s <= last; s += SLOT_STEP) {
    const plan = planDays(date, s, minutes, isClosed);
    if (plan && !plan.some((day) => clashes(day, taken))) out.push(s);
  }
  return out;
}

export function fmtTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
