-- Wave Scape booking database (Cloudflare D1)

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | completed | cancelled
  kind TEXT NOT NULL,                       -- auto | boat
  service TEXT,                             -- int | ext | full (auto only)
  level TEXT,                               -- basic | select (auto only)
  size TEXT,                                -- sedan | suv | truck (auto only)
  job_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  items_json TEXT NOT NULL,
  service_cents INTEGER NOT NULL,
  travel_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  miles REAL NOT NULL,
  vehicle TEXT,
  notes TEXT,
  photos_json TEXT NOT NULL DEFAULT '[]',
  payment_id TEXT,
  receipt_url TEXT
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS bookings_phone ON bookings(phone);

-- One row per calendar day a booking occupies (long boat jobs span days).
CREATE TABLE IF NOT EXISTS booking_days (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_days_date ON booking_days(date);

-- Days the owner closes the calendar.
CREATE TABLE IF NOT EXISTS blocks (
  date TEXT PRIMARY KEY,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS membership_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new',       -- new | active | declined
  plan TEXT NOT NULL,                       -- ext | int | full
  size TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  booking_id TEXT                           -- the Select detail that unlocked it
);
