import { money } from "../../public/assets/pricing.js";
import { fmtTime } from "./schedule.js";
import { escapeHtml as h } from "./http.js";

function when(b) {
  const d = new Date(b.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  return `${d} at ${fmtTime(b.start_min)}`;
}

function itemsTable(b) {
  const items = JSON.parse(b.items_json);
  const rows = items.map((i) => `<tr><td>${h(i.label)}</td><td align="right">${money(i.cents)}</td></tr>`);
  rows.push(`<tr><td>Travel (${b.miles} mi)</td><td align="right">${b.travel_cents ? money(b.travel_cents) : "Free"}</td></tr>`);
  rows.push(`<tr><td><b>Total</b></td><td align="right"><b>${money(b.total_cents)}</b></td></tr>`);
  rows.push(`<tr><td>Deposit paid</td><td align="right">−${money(b.deposit_cents)}</td></tr>`);
  rows.push(`<tr><td><b>Due at the appointment</b></td><td align="right"><b>${money(b.total_cents - b.deposit_cents)}</b></td></tr>`);
  return `<table cellpadding="6" style="border-collapse:collapse;font:14px/1.4 Arial,sans-serif;min-width:320px">${rows.join("")}</table>`;
}

const wrap = (body) => `<div style="font:15px/1.5 Arial,sans-serif;color:#0E1726;max-width:560px">${body}<p style="color:#5A6576;font-size:13px;margin-top:24px">Wave Scape · Mobile auto &amp; marine detailing · (401) 595-5945</p></div>`;

export function customerConfirmation(b) {
  return {
    subject: `You're booked: ${when(b)}`,
    html: wrap(`<h2 style="margin:0 0 8px">Thanks, ${h(b.name.split(" ")[0])}. You're booked.</h2>
      <p><b>${h(when(b))}</b><br>${h(b.address)}</p>
      <p>${h(b.summary)}</p>
      ${itemsTable(b)}
      <p>We bring our own water and power. Just make sure we can reach the ${b.kind === "boat" ? "boat" : "vehicle"}.</p>
      <p>Need to change anything? Call or text (401) 595-5945. Booking number ${h(b.id)}.</p>`),
  };
}

export function ownerNotice(b, siteUrl) {
  const photos = JSON.parse(b.photos_json || "[]");
  return {
    subject: `New booking: ${b.name}, ${when(b)}`,
    html: wrap(`<h2 style="margin:0 0 8px">New booking</h2>
      <p><b>${h(when(b))}</b> (${Math.round(b.minutes / 60 * 10) / 10} hrs)<br>${h(b.address)} · ${b.miles} mi</p>
      <p>${h(b.name)}<br>${h(b.phone)}<br>${h(b.email)}</p>
      <p>${h(b.summary)}${b.vehicle ? `<br>Vehicle: ${h(b.vehicle)}` : ""}${b.notes ? `<br>Notes: ${h(b.notes)}` : ""}</p>
      ${itemsTable(b)}
      ${photos.length ? `<p>${photos.length} photo(s) attached. View them on the admin page.</p>` : ""}
      <p><a href="${siteUrl}/admin/">Open the admin page</a></p>`),
  };
}

export function membershipInvite(b, siteUrl) {
  return {
    subject: "You're eligible for a Wave Scape Select membership",
    html: wrap(`<h2 style="margin:0 0 8px">Thanks for choosing a Select detail</h2>
      <p>Your ${h(b.summary)} unlocks our monthly Select membership: a maintenance visit every month at a members-only rate.</p>
      <p><a href="${siteUrl}/#members">See membership options</a></p>`),
  };
}

export function membershipNotice(m) {
  return {
    subject: `Membership request: ${m.name}`,
    html: wrap(`<h2 style="margin:0 0 8px">New membership request</h2>
      <p>${h(m.planName)} · ${h(m.sizeName)} · ${money(m.price_cents)}/mo</p>
      <p>${h(m.name)}<br>${h(m.phone)}<br>${h(m.email)}</p>
      <p>Set up their monthly billing in Square, then mark the request active on the admin page.</p>`),
  };
}
