import { money, MEMBERSHIPS, SIZE_NAMES } from "./pricing.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtTime = (m) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
const phone = (p) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

async function api(path, opts = {}) {
  const res = await fetch("/api/admin/" + path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function showErr(e) { $("#err").textContent = e ? e.message || e : ""; $("#err").hidden = !e; }

function bookingRows(list, actions) {
  if (!list.length) return `<tr><td>No bookings.</td></tr>`;
  return `<thead><tr><th>When</th><th>Customer</th><th>Job</th><th>Money</th><th>Status</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>` +
    list.map((b) => {
      const items = JSON.parse(b.items_json).map((i) => `${esc(i.label)} ${money(i.cents)}`).join("<br>");
      const photos = JSON.parse(b.photos_json || "[]").map((k, i) => `<a href="/api/admin/photo/${encodeURI(k)}" target="_blank" rel="noopener">Photo ${i + 1}</a>`).join(" · ");
      return `<tr>
        <td><b>${fmtDate(b.date)}</b><br>${fmtTime(b.start_min)}<br><span class="fine">${Math.round((b.minutes / 60) * 10) / 10} hrs</span></td>
        <td><b>${esc(b.name)}</b><br>${phone(esc(b.phone))}<br>${esc(b.email)}<br><span class="fine">${esc(b.address)} · ${b.miles} mi</span></td>
        <td>${items}${b.vehicle ? `<br><i>${esc(b.vehicle)}</i>` : ""}${b.notes ? `<br>Notes: ${esc(b.notes)}` : ""}${photos ? `<br>${photos}` : ""}<br><span class="fine">${esc(b.id)}</span></td>
        <td>Total ${money(b.total_cents)}<br>Deposit ${money(b.deposit_cents)}<br><b>Due ${money(b.total_cents - b.deposit_cents)}</b></td>
        <td><span class="pill ${b.status}">${b.status}</span></td>
        ${actions ? `<td style="white-space:nowrap">${b.status === "confirmed"
          ? `<button class="mini" data-id="${b.id}" data-status="completed">Mark done</button> <button class="mini" data-id="${b.id}" data-status="cancelled">Cancel</button>`
          : `<button class="mini" data-id="${b.id}" data-status="confirmed">Reopen</button>`}</td>` : ""}
      </tr>`;
    }).join("") + "</tbody>";
}

async function loadBookings() {
  const [up, past] = await Promise.all([
    api(`bookings?from=${today}&to=${addDays(today, 90)}`),
    api(`bookings?from=${addDays(today, -30)}&to=${addDays(today, -1)}`),
  ]);
  $("#upcoming").innerHTML = bookingRows(up.bookings, true);
  $("#past").innerHTML = bookingRows(past.bookings.reverse(), true);
}

async function setStatus(id, status) {
  await api(`bookings/${id}`, { method: "POST", body: JSON.stringify({ status }) });
  await loadBookings();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-status]");
  if (!b) return;
  b.disabled = true;
  try {
    if (b.dataset.status === "cancelled" && b.textContent === "Cancel") {
      b.textContent = "Confirm cancel"; b.disabled = false; return;
    }
    await setStatus(b.dataset.id, b.dataset.status);
    if (b.dataset.status === "cancelled") showErr("Booking cancelled. Refund the deposit in your Square dashboard if needed.");
  } catch (err) { showErr(err); b.disabled = false; }
});

async function loadBlocks() {
  const { blocks } = await api("blocks");
  $("#blocks").innerHTML = blocks.length
    ? `<tbody>${blocks.map((b) => `<tr><td><b>${fmtDate(b.date)}</b></td><td>${esc(b.reason)}</td><td><button class="mini" data-unblock="${b.date}">Reopen</button></td></tr>`).join("")}</tbody>`
    : `<tr><td>No closed days coming up.</td></tr>`;
}
$("#blockDate").min = today;
$("#blockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("blocks", { method: "POST", body: JSON.stringify({ date: $("#blockDate").value, reason: $("#blockReason").value }) });
    $("#blockReason").value = "";
    await loadBlocks(); showErr(null);
  } catch (err) { showErr(err); }
});
$("#blocks").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-unblock]");
  if (!b) return;
  try { await api(`blocks?date=${b.dataset.unblock}`, { method: "DELETE" }); await loadBlocks(); } catch (err) { showErr(err); }
});

async function loadMembers() {
  const { memberships } = await api("memberships");
  $("#members").innerHTML = memberships.length
    ? `<thead><tr><th>Requested</th><th>Customer</th><th>Plan</th><th>Status</th><th></th></tr></thead><tbody>${memberships.map((m) => `<tr>
        <td>${esc(m.created_at.slice(0, 10))}</td>
        <td><b>${esc(m.name)}</b><br>${phone(esc(m.phone))}<br>${esc(m.email)}</td>
        <td>${MEMBERSHIPS[m.plan]?.name || m.plan}<br>${SIZE_NAMES[m.size] || m.size} · ${money(m.price_cents)}/mo</td>
        <td><span class="pill ${m.status}">${m.status}</span></td>
        <td style="white-space:nowrap">${m.status === "new" ? `<button class="mini" data-member="${m.id}" data-ms="active">Mark active</button> <button class="mini" data-member="${m.id}" data-ms="declined">Decline</button>` : ""}</td>
      </tr>`).join("")}</tbody>`
    : `<tr><td>No membership requests yet.</td></tr>`;
}
$("#members").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-member]");
  if (!b) return;
  try { await api(`memberships/${b.dataset.member}`, { method: "POST", body: JSON.stringify({ status: b.dataset.ms }) }); await loadMembers(); } catch (err) { showErr(err); }
});

document.querySelector(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]");
  if (!t) return;
  document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b === t));
  document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
});

Promise.all([loadBookings(), loadBlocks(), loadMembers()]).catch(showErr);
