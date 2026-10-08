import { quote, money } from "./pricing.js";
import { mountJobPicker, jobFromParams } from "./job-picker.js";

const $ = (s) => document.querySelector(s);
const show = (el, msg) => { el.textContent = msg; el.hidden = !msg; };

const state = { job: null, minutes: 0, miles: null, address: null, start: null, days: [], date: null, slot: null, photos: [], uploading: 0 };
let card = null;
let fakePayments = false;

/* ---------- 1. the job ---------- */
mountJobPicker($("#picker"), jobFromParams(new URLSearchParams(location.search)), (job) => {
  state.job = job;
  let q = null;
  try { q = quote(job, state.miles ?? 0); } catch {}
  const minutes = q?.minutes || 0;
  if (minutes && minutes !== state.minutes) {
    state.minutes = minutes;
    state.slot = null;
    loadDays();
  }
  const paintWork = job.kind === "auto" ? job.polish || job.ceramic : job.services?.some((s) => s !== "wash");
  $("#photoHint").textContent = paintWork
    ? "Please add 2 to 4 daylight photos of the paint or gelcoat so we can check its condition before polishing or coating."
    : "Photos help us plan the job.";
  $("#vehicleLbl").textContent = job.kind === "boat" ? "Boat (year, make, model)" : "Vehicle (year, make, model, color)";
  drawSummary();
});

function drawSummary() {
  let q;
  try { q = quote(state.job, state.miles ?? 0); } catch (e) { $("#sumLines").innerHTML = `<div><span>${e.message}</span></div>`; return; }
  const rows = q.items.map((i) => `<div><span>${i.label}</span><span>${money(i.cents)}</span></div>`);
  rows.push(state.miles === null
    ? `<div><span>Travel</span><span>Enter address</span></div>`
    : `<div><span>Travel (${state.miles} mi)</span><span>${q.travelCents ? money(q.travelCents) : "Free"}</span></div>`);
  rows.push(`<div class="tot"><span>Total</span><span>${money(q.totalCents)}</span></div>`);
  rows.push(`<div class="dep"><span>Due today (10% deposit)</span><span>${money(q.depositCents)}</span></div>`);
  $("#sumLines").innerHTML = rows.join("");
  $("#payBtn").textContent = `Pay ${money(q.depositCents)} deposit and book`;
  const hrs = Math.round((q.minutes / 60) * 10) / 10;
  $("#sumWhen").textContent = state.slot ? `${fmtDate(state.date)}, ${state.slot.label} · about ${hrs} hrs` : `Pick a time · about ${hrs} hrs`;
}

/* ---------- 2. address ---------- */
async function checkAddress() {
  const addr = $("#address").value.trim();
  show($("#addrErr"), ""); show($("#addrOk"), "");
  if (addr.length < 8) return show($("#addrErr"), "Enter the full address, including city and ZIP code.");
  $("#checkAddr").disabled = true;
  try {
    const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: state.job, address: addr }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.miles = data.miles; state.address = data.address;
    show($("#addrOk"), `${data.address} · ${data.miles} miles from Cranston · travel ${data.quote.travelCents ? money(data.quote.travelCents) : "free"}`);
    drawSummary();
  } catch (e) {
    state.miles = null; state.address = null;
    show($("#addrErr"), e.message || "We couldn't check that address. Try again.");
  } finally {
    $("#checkAddr").disabled = false;
  }
}
$("#checkAddr").addEventListener("click", checkAddress);
$("#address").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); checkAddress(); } });
$("#address").addEventListener("input", () => { if (state.address) { state.miles = null; state.address = null; show($("#addrOk"), ""); drawSummary(); } });

/* ---------- 3. calendar ---------- */
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
let range = null;

async function loadDays() {
  if (!state.minutes) return;
  $("#days").innerHTML = `<p class="fine">Loading open times…</p>`;
  $("#slots").innerHTML = "";
  const qs = new URLSearchParams({ minutes: state.minutes, days: 14 });
  if (state.start) qs.set("start", state.start);
  try {
    const res = await fetch("/api/availability?" + qs);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    range = data;
    state.days = data.days;
    if (!state.start) state.start = data.first;
    drawDays();
  } catch (e) {
    $("#days").innerHTML = `<p class="err">We couldn't load the calendar. Refresh the page, or call or text (401) 595-5945.</p>`;
  }
}

function drawDays() {
  const days = state.days;
  $("#calLabel").textContent = days.length ? `${fmtDate(days[0].date)} – ${fmtDate(days[days.length - 1].date)}` : "";
  $("#prevWeek").disabled = !range || state.start <= range.first;
  $("#nextWeek").disabled = !range || !days.length || days[days.length - 1].date >= range.last;
  $("#days").innerHTML = days.map((d) => {
    const dt = new Date(d.date + "T12:00:00Z");
    const label = d.closed ? d.closed : d.slots.length ? `${d.slots.length} open` : "Full";
    return `<button type="button" class="day" data-date="${d.date}" aria-pressed="${d.date === state.date}" ${d.slots.length ? "" : "disabled"}>
      <span>${dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span><b>${dt.getUTCDate()}</b><small>${label}</small></button>`;
  }).join("");
  drawSlots();
}

function drawSlots() {
  const day = state.days.find((d) => d.date === state.date);
  if (!day) { $("#slots").innerHTML = ""; $("#slotNote").textContent = "Pick a day to see open start times."; return; }
  $("#slots").innerHTML = day.slots.map((s) => `<button type="button" class="slot" data-start="${s.start}" aria-pressed="${state.slot?.start === s.start}">${s.label}</button>`).join("");
  $("#slotNote").textContent = state.minutes > 480 ? "This job runs more than one day. We start at 9 AM and continue on the next open days." : "";
}

$("#days").addEventListener("click", (e) => {
  const b = e.target.closest(".day");
  if (!b || b.disabled) return;
  state.date = b.dataset.date; state.slot = null;
  drawDays(); drawSummary();
});
$("#slots").addEventListener("click", (e) => {
  const b = e.target.closest(".slot");
  if (!b) return;
  const day = state.days.find((d) => d.date === state.date);
  state.slot = day.slots.find((s) => String(s.start) === b.dataset.start);
  drawSlots(); drawSummary();
});
const shift = (n) => { const d = new Date(state.start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); state.start = d.toISOString().slice(0, 10); loadDays(); };
$("#prevWeek").addEventListener("click", () => shift(-14));
$("#nextWeek").addEventListener("click", () => shift(14));

/* ---------- 4. photos ---------- */
$("#photos").addEventListener("change", async (e) => {
  show($("#photoErr"), "");
  for (const file of [...e.target.files].slice(0, 8 - state.photos.length)) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file); img.alt = ""; img.style.opacity = ".4";
    $("#thumbs").append(img);
    state.uploading++;
    try {
      const fd = new FormData(); fd.append("photo", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      state.photos.push(data.key); img.style.opacity = "1";
    } catch (err) {
      img.remove(); show($("#photoErr"), err.message || "A photo didn't upload. Try again.");
    } finally {
      state.uploading--;
    }
  }
  e.target.value = "";
});

/* ---------- 5. deposit ---------- */
async function setupPayments() {
  const cfg = await fetch("/api/config").then((r) => r.json()).catch(() => ({}));
  fakePayments = !!cfg.fakePayments;
  if (fakePayments) { $("#card-container").hidden = true; show($("#payNote"), "Test mode: no card is charged."); return; }
  if (!cfg.squareAppId || !cfg.squareLocationId) {
    $("#card-container").hidden = true;
    show($("#payNote"), "Online payment isn't switched on yet. Call or text (401) 595-5945 to book.");
    $("#payBtn").disabled = true;
    return;
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = cfg.squareEnvironment === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
    s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
  const payments = window.Square.payments(cfg.squareAppId, cfg.squareLocationId);
  card = await payments.card();
  await card.attach("#card-container");
}
setupPayments().catch(() => show($("#payNote"), "The card form didn't load. Refresh the page, or call or text (401) 595-5945."));

function validate() {
  try { quote(state.job, 0); } catch (e) { return e.message; }
  if (!state.address) return "Check your address in step 2.";
  if (!state.slot) return "Pick a day and time in step 3.";
  if (!$("#name").value.trim()) return "Enter your name.";
  if ($("#phone").value.replace(/\D/g, "").length < 10) return "Enter your phone number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("#email").value.trim())) return "Enter a valid email address.";
  if (state.uploading) return "Wait for your photos to finish uploading.";
  return null;
}

$("#payBtn").addEventListener("click", async () => {
  const problem = validate();
  show($("#bookErr"), problem || "");
  if (problem) return;
  const btn = $("#payBtn");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Booking…";
  try {
    let sourceId = null;
    if (!fakePayments) {
      const t = await card.tokenize();
      if (t.status !== "OK") throw new Error(t.errors?.[0]?.message || "Check your card details.");
      sourceId = t.token;
    }
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        job: state.job, address: state.address, date: state.date, start: state.slot.start,
        name: $("#name").value, phone: $("#phone").value, email: $("#email").value,
        vehicle: $("#vehicle").value, notes: $("#notes").value, photos: state.photos,
        sourceId, idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) { state.slot = null; loadDays(); }
      throw new Error(data.error || "Something went wrong. Try again.");
    }
    showDone(data);
  } catch (e) {
    show($("#bookErr"), e.message);
    btn.disabled = false;
    btn.textContent = label;
  }
});

function showDone(b) {
  $("#bookForm").hidden = true;
  document.querySelector(".page-head").hidden = true;
  $("#done").hidden = false;
  $("#doneWhen").textContent = `${fmtDate(b.date)} at ${b.time} · ${b.address}`;
  const rows = b.items.map((i) => `<div><span>${i.label}</span><span>${money(i.cents)}</span></div>`);
  rows.push(`<div><span>Travel (${b.miles} mi)</span><span>${b.travelCents ? money(b.travelCents) : "Free"}</span></div>`);
  rows.push(`<div class="tot"><span>Total</span><span>${money(b.totalCents)}</span></div>`);
  rows.push(`<div class="dep"><span>Deposit paid</span><span>${money(b.depositCents)}</span></div>`);
  rows.push(`<div class="tot"><span>Due at the appointment</span><span>${money(b.totalCents - b.depositCents)}</span></div>`);
  $("#doneLines").innerHTML = rows.join("");
  scrollTo({ top: 0 });
}
