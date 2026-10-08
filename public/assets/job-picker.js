// The "what are we detailing?" controls, shared by the home page quote box
// and the booking page. Renders into a container and reports the job.
import { ADDONS, BOAT_RATES, BOAT_LIMITS, CERAMIC, POLISH, canAddPaintWork, money, sized } from "./pricing.js";

const DEFAULT = { kind: "auto", service: "full", level: "select", size: "sedan", polish: false, ceramic: null, addons: [], length: 24, beam: 8, services: ["wash"] };

export function jobFromParams(params) {
  const j = { ...DEFAULT, addons: [], services: ["wash"] };
  if (params.get("kind") === "boat") j.kind = "boat";
  for (const k of ["service", "level", "size"]) if (params.get(k)) j[k] = params.get(k);
  j.polish = params.get("polish") === "1";
  j.ceramic = Number(params.get("ceramic")) || null;
  if (params.get("addons")) j.addons = params.get("addons").split(",");
  if (params.get("length")) j.length = Number(params.get("length"));
  if (params.get("beam")) { j.beam = Number(params.get("beam")); j.beamTouched = true; }
  if (params.get("services")) j.services = params.get("services").split(",");
  return j;
}

export function jobToParams(job) {
  const p = new URLSearchParams({ kind: job.kind });
  if (job.kind === "auto") {
    p.set("service", job.service); p.set("level", job.level); p.set("size", job.size);
    if (job.polish) p.set("polish", "1");
    if (job.ceramic) p.set("ceramic", job.ceramic);
    if (job.addons.length) p.set("addons", job.addons.join(","));
  } else {
    p.set("length", job.length); p.set("beam", job.beam); p.set("services", job.services.join(","));
  }
  return p;
}

const seg = (name, opts, cls = "") => `<div class="seg ${cls}" role="radiogroup">${opts
  .map(([v, label]) => `<input type="radio" name="${name}" id="${name}-${v}" value="${v}"><label for="${name}-${v}">${label}</label>`)
  .join("")}</div>`;

export function mountJobPicker(root, initial, onChange) {
  const id = root.id || "jp";
  const n = (s) => `${id}-${s}`;
  root.innerHTML = `
    <div class="field"><span>What are we detailing?</span>${seg(n("kind"), [["auto", "Car or truck"], ["boat", "Boat"]], "two")}</div>
    <div data-auto>
      <div class="field"><span>Service</span>${seg(n("service"), [["int", "Interior"], ["ext", "Exterior"], ["full", "Full"]])}</div>
      <div class="field"><span>Package</span>${seg(n("level"), [["basic", "Basic"], ["select", "Select"]], "two")}</div>
      <div class="field"><span>Vehicle</span>${seg(n("size"), [["sedan", "Sedan"], ["suv", "SUV"], ["truck", "Truck"]])}</div>
      <div class="field"><span>Add-ons</span><div class="checks">
        <label class="check" data-paint><input type="checkbox" name="${n("polish")}"><span>Paint polish<small data-paint-why>Needs Select Exterior or Full</small></span><span class="amt" data-polish-amt></span></label>
        ${Object.entries(ADDONS).map(([k, a]) => `<label class="check"><input type="checkbox" name="${n("addon")}" value="${k}"><span>${a.name}</span><span class="amt">+${money(a.price * 100)}</span></label>`).join("")}
      </div></div>
      <div class="field"><label for="${n("ceramic")}"><span class="lbl">Ceramic coating</span></label>
        <select id="${n("ceramic")}"></select>
        <p class="fine" data-ceramic-why style="margin:0">Needs a Select Exterior or Select Full Detail.</p>
        <p class="tip" data-ceramic-tip hidden>We recommend adding a paint polish first. It restores clarity in the paint before the coating locks it in.</p>
      </div>
    </div>
    <div data-boat hidden>
      <div class="field"><span>Boat length</span><div class="range-row">
        <input type="range" id="${n("length")}" min="${BOAT_LIMITS.minLength}" max="${BOAT_LIMITS.maxLength}" step="1" aria-label="Boat length in feet"><output data-length-out></output></div></div>
      <div class="field"><span>Beam (widest point)</span><div class="range-row">
        <input type="range" id="${n("beam")}" min="${BOAT_LIMITS.minBeam}" max="${BOAT_LIMITS.maxBeam}" step="1" aria-label="Boat beam in feet"><output data-beam-out></output></div>
        <p class="fine" data-area style="margin:0"></p></div>
      <div class="field"><span>Services</span><div class="checks">
        ${Object.entries(BOAT_RATES).map(([k, s]) => `<label class="check"><input type="checkbox" name="${n("boatsvc")}" value="${k}"><span>${s.name}</span><span class="amt">$${s.rate % 1 ? s.rate.toFixed(2) : s.rate}/sq ft</span></label>`).join("")}
      </div>
      <p class="tip" data-boat-tip hidden>We recommend a polish first. It restores clarity in the gelcoat before the coating locks it in.</p></div>
    </div>`;

  const q = (s) => root.querySelector(s);
  const state = { ...initial, addons: [...initial.addons], services: [...initial.services] };
  const check = (name, v) => { const el = q(`input[name="${n(name)}"][value="${v}"]`); if (el) el.checked = true; };
  check("kind", state.kind); check("service", state.service); check("level", state.level); check("size", state.size);
  q(`input[name="${n("polish")}"]`).checked = !!state.polish;
  state.addons.forEach((a) => check("addon", a));
  state.services.forEach((s) => check("boatsvc", s));
  q(`#${n("length")}`).value = state.length;
  q(`#${n("beam")}`).value = state.beam;
  q(`#${n("beam")}`).addEventListener("input", () => (state.beamTouched = true));

  function sync() {
    const val = (name) => q(`input[name="${n(name)}"]:checked`)?.value;
    state.kind = val("kind");
    state.service = val("service"); state.level = val("level"); state.size = val("size");
    const paint = canAddPaintWork(state.service, state.level);
    const pc = q(`input[name="${n("polish")}"]`);
    pc.disabled = !paint; if (!paint) pc.checked = false;
    state.polish = pc.checked;
    q("[data-paint]").classList.toggle("off", !paint);
    q("[data-paint-why]").hidden = paint;
    q("[data-polish-amt]").textContent = "+" + money(sized(POLISH, state.size) * 100);
    const cs = q(`#${n("ceramic")}`);
    const prev = !paint ? "" : cs.options.length ? cs.value : state.ceramic ? String(state.ceramic) : "";
    cs.innerHTML = `<option value="">No coating</option>` + Object.entries(CERAMIC)
      .map(([y, p]) => `<option value="${y}">${y}-year coating · +${money(sized(p, state.size) * 100)}</option>`).join("");
    cs.value = prev; cs.disabled = !paint;
    state.ceramic = Number(cs.value) || null;
    q("[data-ceramic-why]").hidden = paint;
    q("[data-ceramic-tip]").hidden = !(state.ceramic && !state.polish);
    state.addons = [...root.querySelectorAll(`input[name="${n("addon")}"]:checked`)].map((i) => i.value);

    const len = q(`#${n("length")}`), bm = q(`#${n("beam")}`);
    state.length = Number(len.value);
    if (!state.beamTouched) bm.value = Math.min(BOAT_LIMITS.maxBeam, Math.max(BOAT_LIMITS.minBeam, Math.round(state.length / 3)));
    state.beam = Number(bm.value);
    q("[data-length-out]").textContent = state.length + " ft";
    q("[data-beam-out]").textContent = state.beam + " ft";
    q("[data-area]").textContent = `Area: ${(state.length * state.beam).toLocaleString("en-US")} sq ft (length × beam)`;
    state.services = [...root.querySelectorAll(`input[name="${n("boatsvc")}"]:checked`)].map((i) => i.value);
    q("[data-boat-tip]").hidden = !(state.services.includes("ceramic") && !state.services.includes("polish"));

    q("[data-auto]").hidden = state.kind !== "auto";
    q("[data-boat]").hidden = state.kind !== "boat";
    onChange(job());
  }
  function job() {
    return state.kind === "auto"
      ? { kind: "auto", service: state.service, level: state.level, size: state.size, polish: state.polish, ceramic: state.ceramic, addons: state.addons }
      : { kind: "boat", length: state.length, beam: state.beam, services: state.services };
  }
  root.addEventListener("input", sync);
  root.addEventListener("change", sync);
  sync();
  return { job };
}
