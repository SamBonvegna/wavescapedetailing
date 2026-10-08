import { AUTO_PRICES, SERVICE_NAMES, SIZE_NAMES, POLISH, CERAMIC, ADDONS, BOAT_RATES, MEMBERSHIPS, sized, membershipPrice, quote, money } from "./pricing.js";
import { mountJobPicker, jobFromParams, jobToParams } from "./job-picker.js";

const $ = (s) => document.querySelector(s);

/* ---------- price menu ---------- */
function drawMenu(size) {
  const cell = (svc, lvl) => {
    const p = sized(AUTO_PRICES[svc][lvl], size);
    let save = "";
    if (svc === "full") {
      const sep = sized(AUTO_PRICES.int[lvl], size) + sized(AUTO_PRICES.ext[lvl], size);
      if (sep > p) save = `<br><span class="save">Save $${sep - p}</span>`;
    }
    return `<td class="${lvl === "select" ? "sel-col" : ""}"><span class="amt">$${p}</span>${save}</td>`;
  };
  const row = (svc) => `<tr><th scope="row">${SERVICE_NAMES[svc]}</th>${cell(svc, "basic")}${cell(svc, "select")}</tr>`;
  $("#menu").innerHTML = `<thead><tr><th></th><th scope="col">Basic</th><th scope="col" class="sel-col">Select</th></tr></thead><tbody>${row("int")}${row("ext")}${row("full")}</tbody>`;
  $("#polishRows").innerHTML = Object.keys(SIZE_NAMES).map((z) => `<div class="row"><b>${SIZE_NAMES[z]}</b><span>from $${sized(POLISH, z)}</span></div>`).join("");
  $("#ceramicRows").innerHTML = Object.entries(CERAMIC).map(([y, p]) => `<div class="row"><b>${y}-year</b><span>$${sized(p, size)}</span></div>`).join("");
}
$(".menu-bar").addEventListener("input", (e) => drawMenu(e.target.value));
drawMenu("sedan");
$("#addonRows").innerHTML = Object.values(ADDONS).map((a) => `<div class="row"><b>${a.name}</b><span>+$${a.price}</span></div>`).join("");
$("#rates").innerHTML = Object.values(BOAT_RATES).map((b) => `<div><p><b>${b.name}</b></p><span>$${b.rate % 1 ? b.rate.toFixed(2) : b.rate}/sq ft</span></div>`).join("");
document.querySelectorAll("[data-plan]").forEach((el) => {
  const p = el.dataset.plan;
  el.querySelector(".sizes-line").textContent = `SUV $${membershipPrice(p, "suv")} · Truck $${membershipPrice(p, "truck")}`;
});

/* ---------- instant quote ---------- */
const miles = $("#miles");
let currentJob;
function drawQuote() {
  $("#milesOut").textContent = miles.value + " mi";
  const lines = $("#lines");
  try {
    const q = quote(currentJob, Number(miles.value));
    const rows = q.items.map((i) => `<div><span>${i.label}</span><span>${money(i.cents)}</span></div>`);
    rows.push(`<div><span>Travel</span><span>${q.travelCents ? money(q.travelCents) : "Free"}</span></div>`);
    rows.push(`<div class="tot"><span>Total</span><span>${money(q.totalCents)}</span></div>`);
    rows.push(`<div class="dep"><span>Due today (10% deposit)</span><span>${money(q.depositCents)}</span></div>`);
    lines.innerHTML = rows.join("");
  } catch (e) {
    lines.innerHTML = `<div><span>${e.message}</span></div>`;
  }
}
const picker = mountJobPicker($("#picker"), jobFromParams(new URLSearchParams()), (job) => { currentJob = job; drawQuote(); });
miles.addEventListener("input", drawQuote);
$("#quote").addEventListener("submit", (e) => {
  e.preventDefault();
  location.href = "/book/?" + jobToParams(picker.job()).toString();
});

/* ---------- membership requests ---------- */
const dlg = $("#joinDialog");
let plan = null;
document.querySelectorAll("[data-join]").forEach((btn) =>
  btn.addEventListener("click", () => {
    plan = btn.closest("[data-plan]").dataset.plan;
    $("#joinTitle").textContent = MEMBERSHIPS[plan].name;
    $("#joinErr").hidden = true; $("#joinOk").hidden = true; $("#joinSubmit").hidden = false;
    updateJoinPrice();
    dlg.showModal();
  })
);
function updateJoinPrice() {
  const size = document.querySelector('input[name="jsize"]:checked').value;
  $("#joinSubmit").textContent = `Request membership · $${membershipPrice(plan, size)}/mo`;
}
document.querySelectorAll('input[name="jsize"]').forEach((i) => i.addEventListener("change", updateJoinPrice));
$("#joinCancel").addEventListener("click", () => dlg.close());
$("#joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#joinSubmit");
  btn.disabled = true;
  $("#joinErr").hidden = true;
  try {
    const res = await fetch("/api/membership", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan, size: document.querySelector('input[name="jsize"]:checked').value,
        name: $("#jname").value, email: $("#jemail").value, phone: $("#jphone").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    $("#joinOk").textContent = "Request sent. We'll text you to set up your monthly billing.";
    $("#joinOk").hidden = false;
    btn.hidden = true;
  } catch (err) {
    $("#joinErr").textContent = err.message;
    $("#joinErr").hidden = false;
  } finally {
    btn.disabled = false;
  }
});

/* ---------- ambient ripples in the hero ---------- */
(function () {
  const c = $("#ripples");
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x = c.getContext("2d");
  let w, h, t = 0;
  const dpr = devicePixelRatio || 1;
  function size() { const r = c.getBoundingClientRect(); w = c.width = r.width * dpr; h = c.height = r.height * dpr; }
  size();
  addEventListener("resize", size);
  (function draw() {
    x.clearRect(0, 0, w, h);
    x.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 9; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.1 + i * 0.025})`;
      x.beginPath();
      const y0 = h * (0.15 + i * 0.09);
      for (let px = 0; px <= w; px += 8) {
        const y = y0 + Math.sin(px / (140 * dpr) + t + i * 0.7) * 14 * dpr + Math.sin(px / (60 * dpr) - t * 1.3) * 4 * dpr;
        px ? x.lineTo(px, y) : x.moveTo(px, y);
      }
      x.stroke();
    }
    t += 0.012;
    requestAnimationFrame(draw);
  })();
})();

