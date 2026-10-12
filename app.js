/* Service Desk — a simplified front end for repair lookups, repairs and parts.
 * All data below is made up for the demo. To connect a real backend, replace
 * the functions in the `api` object; the screens only talk to `api`. */

"use strict";

/* ====================================================================
 * Demo data
 * ==================================================================== */

const DAY = 864e5;
const today = new Date();
const daysFromNow = (n) => new Date(today.getTime() + n * DAY).toISOString().slice(0, 10);

const DEVICES = [
  {
    serial: "C02XG1JHJG5J", imei: null, kind: "mac",
    name: 'MacBook Pro 14"', config: "M3 Pro, 18GB, 512GB, Space Black",
    purchased: daysFromNow(-1050), appleCare: true, coverageEnd: daysFromNow(45),
    diag: { Battery: "pass", Display: "pass", Storage: "pass", Keyboard: "fail", Thermal: "pass" },
  },
  {
    serial: "F2LXK9ABCD12", imei: "353918104552210", kind: "iphone",
    name: "iPhone 15 Pro", config: "256GB, Natural Titanium",
    purchased: daysFromNow(-420), appleCare: false, coverageEnd: daysFromNow(-55),
    diag: { Battery: "fail", Display: "pass", Camera: "pass", Audio: "pass", Sensors: "pass" },
  },
  {
    serial: "HX7QW2M4PL9N", imei: "356789104523781", imei2: "356789104523799", kind: "iphone",
    name: "iPhone 16", config: "128GB, Black",
    purchased: daysFromNow(-190), appleCare: false, coverageEnd: daysFromNow(175),
    diag: { Battery: "pass", Display: "fail", Camera: "pass", Audio: "pass", Sensors: "pass" },
  },
  {
    serial: "DMPYH7Q2JF8K", imei: null, kind: "ipad",
    name: "iPad Air 11\"", config: "M2, 128GB, Wi-Fi, Blue",
    purchased: daysFromNow(-300), appleCare: true, coverageEnd: daysFromNow(430),
    diag: { Battery: "pass", Display: "pass", Camera: "pass", Audio: "pass", Charging: "pass" },
  },
  {
    serial: "G6TZ3L0QW1MX", imei: null, kind: "watch",
    name: "Apple Watch Series 9", config: "45mm, Aluminum, Midnight",
    purchased: daysFromNow(-800), appleCare: false, coverageEnd: daysFromNow(-435),
    diag: { Battery: "fail", Display: "pass", Sensors: "pass", Charging: "pass" },
  },
];

// Codes are placeholders; plain-language names are what the user picks.
const ISSUES = [
  { id: "screen",   ico: "📱", name: "Cracked or broken screen", hint: "Cracked glass, lines, dead spots, or no picture", code: "DSP · Display damaged", accidental: true },
  { id: "battery",  ico: "🔋", name: "Battery problem",          hint: "Drains fast, swollen, or shows a service warning", code: "BAT · Battery degraded" },
  { id: "power",    ico: "⏻", name: "Won't turn on",             hint: "No response to power button or charger",         code: "PWR · No power" },
  { id: "charging", ico: "⚡", name: "Won't charge",              hint: "Charges slowly or not at all",                   code: "CHG · Charging failure" },
  { id: "liquid",   ico: "💧", name: "Liquid damage",             hint: "Was exposed to water or another liquid",          code: "LQD · Liquid contact", accidental: true },
  { id: "camera",   ico: "📷", name: "Camera problem",            hint: "Blurry, black, or app won't open",                code: "CAM · Camera failure", kinds: ["iphone", "ipad"] },
  { id: "audio",    ico: "🔊", name: "Speaker or microphone",     hint: "No sound, crackling, or callers can't hear",      code: "AUD · Audio failure" },
  { id: "keyboard", ico: "⌨", name: "Keyboard or trackpad",       hint: "Keys stick, repeat, or don't respond",           code: "KBD · Input failure", kinds: ["mac"] },
  { id: "buttons",  ico: "🔘", name: "Buttons not working",       hint: "Side, volume, or Digital Crown",                  code: "BTN · Button failure", kinds: ["iphone", "ipad", "watch"] },
];

const ISSUE_CATEGORIES = [
  ["apps", "Apple Applications", "26092B"],
  ["intelligence", "Apple Intelligence & Siri", "26132A"],
  ["audio", "Audio", "26102"],
  ["biometrics", "Biometrics", "26121"],
  ["wireless", "Bluetooth / Wi-Fi", "26094A"],
  ["buttons", "Buttons and Switches", "26093D"],
  ["sensors", "Sensors", "26100D"],
  ["setup", "Setup Assistant / Backup / Migration", "26101E"],
  ["startup", "System Startup / Stability", "26104A"],
  ["unknown", "Unknown OSS Symptom", "OSSUK"],
  ["update", "Update / Restore", "26118"],
  ["haptics", "Vibration / Haptics", "26117"],
];
const CUSTOMER_ISSUES = [
  { id: "accessibility-hearing", category: "Accessibility", name: "Hearing", code: "PD41-09" },
  { id: "accessibility-motor", category: "Accessibility", name: "Physical & Motor", code: "IP42C" },
  { id: "accessibility-speech", category: "Accessibility", name: "Speech & General", code: "PD42-17" },
  { id: "accessibility-vision", category: "Accessibility", name: "Vision", code: "IP518" },
  ...ISSUES.map((issue) => ({ id: issue.id, category: "Common device issues", name: issue.name, code: issue.code })),
];

const PARTS = {
  mac: {
    screen:   [["Display assembly", 599]],
    battery:  [["Battery with top case", 249]],
    power:    [["Logic board", 749]],
    charging: [["USB-C port board", 129]],
    liquid:   [["Logic board", 749], ["Top case with keyboard", 349]],
    audio:    [["Speaker set", 89]],
    keyboard: [["Top case with keyboard", 349]],
  },
  iphone: {
    screen:   [["Display", 329]],
    battery:  [["Battery", 99]],
    power:    [["Whole-unit replacement", 549]],
    charging: [["Charging port assembly", 119]],
    liquid:   [["Whole-unit replacement", 549]],
    camera:   [["Rear camera module", 169]],
    audio:    [["Bottom speaker", 79]],
    buttons:  [["Side button flex", 69]],
  },
  ipad: {
    screen:   [["Whole-unit replacement", 399]],
    battery:  [["Battery service (unit swap)", 199]],
    power:    [["Whole-unit replacement", 399]],
    charging: [["Whole-unit replacement", 399]],
    liquid:   [["Whole-unit replacement", 399]],
    camera:   [["Whole-unit replacement", 399]],
    audio:    [["Whole-unit replacement", 399]],
    buttons:  [["Whole-unit replacement", 399]],
  },
  watch: {
    screen:   [["Whole-unit replacement", 299]],
    battery:  [["Battery service (unit swap)", 99]],
    power:    [["Whole-unit replacement", 299]],
    charging: [["Whole-unit replacement", 299]],
    liquid:   [["Whole-unit replacement", 299]],
    audio:    [["Whole-unit replacement", 299]],
    buttons:  [["Whole-unit replacement", 299]],
  },
};

const REPAIR_TYPES = [
  { id: "carry-in", name: "Fix it here", sub: "Carry-in", desc: "Customer leaves the device with you and you repair it in the store. Usually 1–3 days." },
  { id: "mail-in",  name: "Send it out", sub: "Mail-in",  desc: "Ship the device to an Apple repair center. Usually 5–7 business days." },
  { id: "swap",     name: "Swap the whole unit", sub: "Whole-unit replacement", desc: "Give the customer a replacement unit and return the old one." },
];

// Status pipeline, in order. `next` is the button label that moves a repair forward.
const STATUSES = [
  { id: "open",    name: "Checked in",        tone: "info", next: "Order parts",          help: "Parts haven't been ordered yet." },
  { id: "parts",   name: "Waiting on parts",  tone: "warn", next: "Parts arrived — start repair", help: "Parts are on the way." },
  { id: "repair",  name: "In repair",         tone: "info", next: "Mark repair done",     help: "A technician is working on it." },
  { id: "pickup",  name: "Ready for pickup",  tone: "good", next: "Customer picked it up", help: "Let the customer know it's ready." },
  { id: "closed",  name: "Closed",            tone: "",     next: null,                   help: "This repair is finished." },
];
const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

const RETURN_WINDOW_DAYS = 15;

const SEED_REPAIRS = [
  { id: "R100231", serial: "F2LXK9ABCD12", issue: "battery", type: "carry-in", status: "parts",  customer: "Maya Torres",  email: "maya@example.com", created: daysFromNow(-2),  parts: [["Battery", 99]], cost: 99, notes: "Battery health 71%.", returned: false },
  { id: "R100224", serial: "C02XG1JHJG5J", issue: "keyboard", type: "carry-in", status: "repair", customer: "Sam Lee",     email: "sam@example.com",  created: daysFromNow(-6),  parts: [["Top case with keyboard", 349]], cost: 0, notes: "", returned: false },
  { id: "R100219", serial: "G6TZ3L0QW1MX", issue: "battery", type: "mail-in",  status: "pickup", customer: "Priya Shah",   email: "priya@example.com", created: daysFromNow(-12), parts: [["Battery service (unit swap)", 99]], cost: 99, notes: "", returned: false },
  { id: "R100198", serial: "DMPYH7Q2JF8K", issue: "screen",  type: "swap",     status: "closed", customer: "Jordan Park",  email: "jordan@example.com", created: daysFromNow(-30), parts: [["Whole-unit replacement", 399]], cost: 49, notes: "", returned: true },
];

/* ====================================================================
 * API layer (demo). Swap these for real calls later.
 * ==================================================================== */

const STORE_KEY = "service-desk-repairs-v1";

function loadRepairs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* storage unavailable — fall back to seed data */ }
  return structuredClone(SEED_REPAIRS);
}
function saveRepairs() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.repairs)); } catch (_) { /* ignore */ }
}

const api = {
  findDevice(q) {
    const n = normalize(q);
    return DEVICES.find((d) => d.serial === n || d.imei === n) || null;
  },
  findRepair(q) {
    const n = normalize(q);
    return state.repairs.find((r) => r.id === n) || null;
  },
  createRepair(data) {
    const max = Math.max(100000, ...state.repairs.map((r) => Number(r.id.slice(1))));
    const repair = { id: "R" + (max + 1), created: daysFromNow(0), status: "open", returned: false, ...data };
    state.repairs.unshift(repair);
    saveRepairs();
    return repair;
  },
  advanceRepair(id) {
    const r = api.findRepair(id);
    const i = STATUSES.findIndex((s) => s.id === r.status);
    if (i < STATUSES.length - 1) r.status = STATUSES[i + 1].id;
    saveRepairs();
    return r;
  },
  markReturned(id) {
    api.findRepair(id).returned = true;
    saveRepairs();
  },
};

/* ====================================================================
 * Helpers
 * ==================================================================== */

const normalize = (s) => String(s || "").replace(/[\s-]/g, "").toUpperCase();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => (n === 0 ? "$0" : "$" + n.toLocaleString("en-US"));
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysUntil = (iso) => Math.ceil((new Date(iso + "T23:59:59") - today) / DAY);
const deviceBySerial = (s) => DEVICES.find((d) => d.serial === s);
const issueById = (id) => ISSUES.find((i) => i.id === id) || CUSTOMER_ISSUES.find((i) => i.id === id);
const typeById = (id) => REPAIR_TYPES.find((t) => t.id === id);
const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

function coverageOf(d, appleCare = false) {
  const left = daysUntil(d.coverageEnd);
  if (left < 0) {
    return { tone: "bad", ico: "✕", title: "Not covered", short: "Not covered",
      detail: `Coverage ended ${fmtDate(d.coverageEnd)}. The customer pays the full repair price.` };
  }
  const acPlus = appleCare === true;
  const tone = left <= 60 ? "warn" : "good";
  const soon = left <= 60 ? ` Coverage ends in ${left} days, so book repairs soon.` : "";
  return {
    tone, ico: "✓", short: acPlus ? "AppleCare+" : "Warranty",
    title: acPlus ? "Covered by AppleCare+" : "Covered by limited warranty",
    detail: acPlus
      ? `Covered until ${fmtDate(d.coverageEnd)}. Defects are free; accidental damage has a small service fee.${soon}`
      : `Covered until ${fmtDate(d.coverageEnd)}. Defects are free; accidental damage is NOT covered.${soon}`,
  };
}

/** What the customer pays for one part, given the device's coverage and the issue. */
function priceFor(device, issue, fullPrice, appleCare = false) {
  const cov = coverageOf(device, appleCare);
  if (cov.tone === "bad") return { pay: fullPrice, why: "Not covered" };
  if (!issue.accidental) return { pay: 0, why: "Covered defect" };
  if (appleCare) {
    const fee = device.kind === "mac" ? 99 : device.kind === "watch" ? 69 : 49;
    return { pay: Math.min(fee, fullPrice), why: "AppleCare+ service fee" };
  }
  return { pay: fullPrice, why: "Accidental damage isn't covered" };
}

function badge(statusId) {
  const s = statusById[statusId];
  return `<span class="badge ${s.tone}">${esc(s.name)}</span>`;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ====================================================================
 * State & routing
 * ==================================================================== */

const state = {
  repairs: loadRepairs(),
  recent: [],            // recently viewed serials
  appleCareBySerial: {}, // customer answers captured during the current lookup
  repairFilter: "active",
  repairQuery: "",
  wizard: null,          // { serial, step, issue, type, parts:Set, customer, email, notes }
};

const routes = {
  home: renderHome,
  device: renderDevice,
  new: renderWizard,
  repairs: renderRepairs,
  repair: renderRepairDetail,
  parts: renderParts,
  help: renderHelp,
};

function go(path) { location.hash = "#/" + path; }

function router() {
  const [name = "home", arg] = location.hash.replace(/^#\/?/, "").split("/");
  const view = routes[name] || renderHome;
  view(decodeURIComponent(arg || ""));
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === name || (name === "repair" && a.dataset.nav === "repairs")
      || ((name === "device" || name === "new") && a.dataset.nav === "home");
    a.classList.toggle("active", active);
  });
  updateNavCounts();
  closeMenu();
  window.scrollTo(0, 0);
}

function updateNavCounts() {
  const open = state.repairs.filter((r) => r.status !== "closed").length;
  const due = returnsDue().length;
  $("#nav-open-count").textContent = open || "";
  $("#nav-returns-count").textContent = due || "";
}

/** One search box handles serials, IMEIs and repair IDs. */
function search(q) {
  if (!q.trim()) return;
  const device = api.findDevice(q);
  if (device) return go("device/" + device.serial);
  const repair = api.findRepair(q);
  if (repair) return go("repair/" + repair.id);
  toast(`Nothing found for "${q.trim()}". Check the number and try again.`);
}

/* ====================================================================
 * Screens
 * ==================================================================== */

function renderHome() {
  const active = state.repairs.filter((r) => r.status !== "closed");
  const ready = active.filter((r) => r.status === "pickup").length;
  const waiting = active.filter((r) => r.status === "parts").length;
  const due = returnsDue().length;

  main.innerHTML = `
    <section class="hero">
      <h1>Look up a device</h1>
      <p class="muted">Enter a serial number, IMEI, or repair ID. The serial identifies the exact device and its AppleCare+ record.</p>
      <form class="hero-search" id="hero-search">
        <input id="hero-input" type="search" autocomplete="off" placeholder="e.g. C02XG1JHJG5J" aria-label="Serial number, IMEI, or repair ID" autofocus>
        <button class="btn primary big" type="submit">Look up</button>
      </form>
      <p class="small muted">Find the serial in Settings → General → About, or on the bottom of the device.</p>
      <div class="chips" aria-label="Demo devices to try">
        <span class="small muted" style="align-self:center">Try:</span>
        ${DEVICES.map((d) => `<button class="chip" data-serial="${d.serial}">${esc(d.name)}</button>`).join("")}
      </div>
    </section>

    <h2>Today at a glance</h2>
    <div class="grid tiles">
      <a class="card stat" href="#/repairs" data-filter="active"><div class="num">${active.length}</div><div class="muted">Open repairs</div></a>
      <a class="card stat" href="#/repairs" data-filter="pickup"><div class="num">${ready}</div><div class="muted">Ready for pickup</div></a>
      <a class="card stat" href="#/repairs" data-filter="parts"><div class="num">${waiting}</div><div class="muted">Waiting on parts</div></a>
      <a class="card stat" href="#/parts"><div class="num">${due}</div><div class="muted">Parts to send back</div></a>
    </div>

    ${state.recent.length ? `
      <h2>Recently viewed</h2>
      <div class="chips" style="justify-content:flex-start">
        ${state.recent.map((s) => `<button class="chip" data-serial="${s}">${esc(deviceBySerial(s).name)} · <span class="mono">${s}</span></button>`).join("")}
      </div>` : ""}
  `;

  $("#hero-search").addEventListener("submit", (e) => { e.preventDefault(); search($("#hero-input").value); });
  main.querySelectorAll("[data-serial]").forEach((b) => b.addEventListener("click", () => go("device/" + b.dataset.serial)));
  main.querySelectorAll("[data-filter]").forEach((a) => a.addEventListener("click", () => { state.repairFilter = a.dataset.filter; }));
}

function renderDevice(serial) {
  const d = deviceBySerial(serial);
  if (!d) return renderNotFound("We couldn't find that device.");
  state.recent = [serial, ...state.recent.filter((s) => s !== serial)].slice(0, 5);

  const appleCare = state.appleCareBySerial[serial] ?? d.appleCare;
  const cov = coverageOf(d, appleCare === true);
  const history = state.repairs.filter((r) => r.serial === serial);
  const openRepair = history.find((r) => r.status !== "closed");

  main.innerHTML = `
    <div class="workbench-head">
      <a href="#/home">← New lookup</a>
      <span class="workbench-context">New repair · ${esc(d.name)}</span>
      <span class="spacer"></span>
      ${openRepair ? `<a class="btn" href="#/repair/${openRepair.id}">Open ${esc(openRepair.id)}</a>` : ""}
      <button class="btn primary" id="start-repair">Start repair</button>
    </div>
    <div class="workbench">
      <section class="workbench-device">
        <div class="device-glyph" aria-hidden="true">${d.kind === "mac" ? "▣" : d.kind === "watch" ? "◉" : "▯"}</div>
        <h1>${esc(d.name)}</h1>
        <p class="muted">${esc(d.config)}</p>
        <div class="coverage ${cov.tone}">
          <span class="big-ico" aria-hidden="true">${cov.ico}</span>
          <div><h2>${esc(cov.title)}</h2><p>${esc(cov.detail)}</p></div>
        </div>
        <dl class="facts">
          <div><dt>Serial number</dt><dd class="mono">${d.serial}</dd></div>
          ${d.imei ? `<div><dt>IMEI</dt><dd class="mono">${d.imei}</dd></div>` : ""}
          ${d.imei2 ? `<div><dt>IMEI 2</dt><dd class="mono">${d.imei2}</dd></div>` : ""}
          <div><dt>Purchased</dt><dd>${fmtDate(d.purchased)}</dd></div>
          <div><dt>Coverage ends</dt><dd>${fmtDate(d.coverageEnd)}</dd></div>
        </dl>
        <div class="coverage-question ${appleCare === undefined ? "needs-answer" : ""}">
          <strong>AppleCare+ for this serial</strong>
          <span class="small muted">${appleCare === true ? "Found on the customer coverage record. Confirm with the customer." : "No AppleCare+ found on the customer coverage record. Confirm with the customer."}</span>
          <div class="answer-buttons" role="group" aria-label="AppleCare+ customer coverage">
            <button class="btn ${appleCare === true ? "selected" : ""}" data-applecare="yes" aria-pressed="${appleCare === true}">Yes</button>
            <button class="btn ${appleCare === false ? "selected" : ""}" data-applecare="no" aria-pressed="${appleCare === false}">No</button>
          </div>
        </div>
      </section>
      <section class="card workbench-customer">
        <div class="panel-title"><h2>Customer</h2><span class="panel-status">Required for intake</span></div>
        <div class="customer-fields">
          <label>First name<input type="text" placeholder="First name"></label>
          <label>Last name<input type="text" placeholder="Last name"></label>
          <label>Email<input type="email" placeholder="customer@example.com"></label>
          <label>Phone number<input type="tel" placeholder="(555) 555-0123"></label>
          <label>Purchase order / reference<input type="text" placeholder="Optional reference"></label>
          <label class="sms-field"><input type="checkbox"> SMS update</label>
          <label class="wide">Address<input type="text" placeholder="Street, city, state, ZIP"></label>
          <label class="wide">Customer intake notes<textarea rows="2" placeholder="What did the customer report?"></textarea></label>
        </div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Diagnostics</h2><button class="btn small-btn" id="run-diag">Run diagnostics</button></div>
        <div id="diag-body"><p class="muted small">Run a quick check to help identify the issue.</p></div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Repair details</h2>${openRepair ? badge(openRepair.status) : `<span class="panel-status">Not started</span>`}</div>
        ${openRepair ? `<p class="small"><strong>${esc(issueById(openRepair.issue).name)}</strong><br><a href="#/repair/${openRepair.id}">${esc(openRepair.id)}</a> · ${esc(typeById(openRepair.type).name)}</p>` : `<p class="muted small">Choose an issue and repair type to see the work order here.</p>`}
        <div class="panel-action"><button class="btn" id="repair-details-action">${openRepair ? "View repair details" : "Choose issue"}</button></div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Parts</h2><span class="panel-status">${openRepair ? `${openRepair.parts.length} selected` : "None selected"}</span></div>
        ${openRepair && openRepair.parts.length ? `<ul class="compact-list">${openRepair.parts.map((p) => `<li><span>${esc(p[0])}</span><strong>${money(p[1])}</strong></li>`).join("")}</ul>` : `<p class="empty">No part added yet.</p>`}
        <div class="panel-action"><button class="btn" id="parts-action">${openRepair ? "View parts" : "Add parts after issue"}</button></div>
      </section>
      <section class="card workbench-panel notes-panel">
        <div class="panel-title"><h2>Notes</h2><span class="panel-status">Internal</span></div>
        <label class="sr-only" for="tech-notes">Technician notes</label>
        <textarea id="tech-notes" rows="4" placeholder="Add technician notes"></textarea>
        <p class="small muted">Customer notes stay with the repair record.</p>
      </section>
    </div>
    <div class="workbench-nav" aria-label="Repair workspace sections">
      <span class="active">Overview</span><span>Diagnostics · ${openRepair ? "Done" : "Not run"}</span><span>Repair details · ${openRepair ? "Done" : "Incomplete"}</span><span>Parts · ${openRepair ? "Done" : "Incomplete"}</span><span>Notes · Incomplete</span>
    </div>
    <div class="workbench-next">Next step: ${openRepair ? "Review the existing repair" : "Enter customer information"} <span class="muted">Save and submit remain disabled until required fields are complete.</span></div>
  `;

  const openRepairOrWizard = () => {
    state.wizard = {
      serial, appleCare, step: 0, issue: null, issueCategory: "accessibility",
      verifiedIssue: null, useReported: true, type: null, parts: new Set(),
      customer: "", email: "", phone: "", address: "", receivedAt: "", notes: "",
    };
    go("new");
  };
  $("#start-repair").addEventListener("click", openRepairOrWizard);
  $("#repair-details-action").addEventListener("click", () => openRepair ? go("repair/" + openRepair.id) : openRepairOrWizard());
  $("#parts-action").addEventListener("click", () => openRepair ? go("repair/" + openRepair.id) : openRepairOrWizard());
  $("#run-diag").addEventListener("click", () => runDiagnostics(d));
  main.querySelectorAll("[data-applecare]").forEach((button) => button.addEventListener("click", () => {
    state.appleCareBySerial[serial] = button.dataset.applecare === "yes";
    renderDevice(serial);
  }));
}

function runDiagnostics(d) {
  const body = $("#diag-body");
  const btn = $("#run-diag");
  btn.disabled = true;
  body.innerHTML = `<div class="progress"><div></div></div><p class="small muted" id="diag-status">Starting…</p>`;
  const bar = body.querySelector(".progress > div");
  const tests = Object.keys(d.diag);
  let i = 0;
  const tick = setInterval(() => {
    if (!document.body.contains(bar)) return clearInterval(tick); // user navigated away
    i++;
    bar.style.width = (i / tests.length) * 100 + "%";
    $("#diag-status").textContent = i < tests.length ? `Checking ${tests[i]}…` : "Done";
    if (i < tests.length) return;
    clearInterval(tick);
    btn.disabled = false;
    const failed = tests.filter((t) => d.diag[t] === "fail");
    body.innerHTML = `
      <ul class="diag-list">${tests.map((t) => `<li><span>${t}</span>${d.diag[t] === "pass"
        ? `<span class="badge good">Passed</span>` : `<span class="badge bad">Needs attention</span>`}</li>`).join("")}</ul>
      <p class="small" style="margin-top:12px">${failed.length
        ? `<strong>${failed.join(", ")}</strong> failed. Start a repair and pick the matching issue.`
        : "Everything passed. If the customer still sees a problem, describe it in the repair notes."}</p>`;
  }, 450);
}

/* ---------- New repair wizard ---------- */

const WIZARD_STEPS = ["Customer issue", "Repair details", "Parts & notes", "Customer & submit"];

function renderWizard() {
  const w = state.wizard;
  if (!w) return go("home");
  const d = deviceBySerial(w.serial);
  const issues = ISSUES.filter((i) => !i.kinds || i.kinds.includes(d.kind));

  const stepper = `<ol class="stepper">${WIZARD_STEPS.map((s, i) =>
    `<li class="${i < w.step ? "done" : i === w.step ? "current" : ""}" ${i === w.step ? 'aria-current="step"' : ""}>${s}</li>`).join("")}</ol>`;

  let body = "";
  let canNext = false;

  if (w.step === 0) {
    const failing = Object.keys(d.diag).filter((t) => d.diag[t] === "fail").join(", ");
    const categories = [["accessibility", "Accessibility", "CUSTOMER"], ...ISSUE_CATEGORIES];
    const selectedCategory = w.issueCategory || "accessibility";
    const categoryIssues = selectedCategory === "accessibility"
      ? CUSTOMER_ISSUES.filter((i) => i.category === "Accessibility")
      : selectedCategory === "common"
        ? CUSTOMER_ISSUES.filter((i) => i.category === "Common device issues")
        : CUSTOMER_ISSUES.filter((i) => i.category === "Common device issues");
    body = `
      <h2>Customer reported component / issue</h2>
      <p class="muted">Choose a component category, then the reported issue. Standardized codes keep the repair record consistent.${failing ? ` Diagnostics flagged: <strong>${esc(failing)}</strong>.` : ""}</p>
      <div class="issue-picker">
        <div class="issue-categories">
          ${categories.map(([id, name, code]) => `<button class="issue-category ${selectedCategory === id ? "selected" : ""}" data-category="${id}"><span>${esc(name)}</span><code>${code}</code></button>`).join("")}
          <button class="issue-category ${selectedCategory === "common" ? "selected" : ""}" data-category="common"><span>Common device issues</span><code>LOCAL</code></button>
        </div>
        <div class="issue-options">
          <div class="panel-title"><strong>${esc(categories.find((c) => c[0] === selectedCategory)?.[1] || "Issues")}</strong><span class="panel-status">${categoryIssues.length} options</span></div>
          ${categoryIssues.map((i) => `<button class="issue-option ${w.issue === i.id ? "selected" : ""}" data-issue="${i.id}"><span>${esc(i.name)}</span><code>(${esc(i.code)})</code></button>`).join("")}
        </div>
      </div>`;
    canNext = !!w.issue;
  }

  if (w.step === 1) {
    const recommended = d.kind === "watch" || d.kind === "ipad" ? "swap" : "carry-in";
    if (!w.type) w.type = recommended;
    body = `
      <h2>Repair details</h2>
      <p class="muted">Confirm the technician-verified issue before selecting the repair type.</p>
      <label class="check-row"><input type="checkbox" id="use-reported" ${w.useReported ? "checked" : ""}> Use customer reported component / issue</label>
      <div class="field"><label for="verified-issue">Technician verified component / issue</label>
        <select id="verified-issue">${CUSTOMER_ISSUES.map((i) => `<option value="${i.id}" ${w.verifiedIssue === i.id ? "selected" : ""}>${esc(i.name)} (${esc(i.code)})</option>`).join("")}</select>
      </div>
      <h3>Repair type</h3>
      <div class="grid tiles">${REPAIR_TYPES.map((t) => `
        <button class="tile" data-type="${t.id}" aria-pressed="${w.type === t.id}">
          <span class="t-title">${esc(t.name)} ${t.id === recommended ? '<span class="badge info">Recommended</span>' : ""}</span>
          <span class="t-hint">${esc(t.desc)}</span>
          <span class="t-code">${esc(t.sub)}</span>
        </button>`).join("")}</div>`;
    canNext = !!w.type;
  }

  if (w.step === 2) {
    const issue = issueById(w.verifiedIssue || w.issue) || { name: "the reported issue", accidental: false };
    const selectedIssue = w.verifiedIssue || w.issue;
    const suggested = (PARTS[d.kind][selectedIssue] || []);
    if (w.parts.size === 0 && !w.partsTouched) suggested.forEach((p) => w.parts.add(p[0]));
    const cov = coverageOf(d, w.appleCare);
    const total = suggested.filter((p) => w.parts.has(p[0])).reduce((sum, p) => sum + priceFor(d, issue, p[1], w.appleCare).pay, 0);
    body = `
      <h2>Parts & notes</h2>
      <p class="muted">These parts usually fix "${esc(issue.name.toLowerCase())}". Prices already include coverage
        (<span class="badge ${cov.tone}">${esc(cov.short)}</span>).</p>
      <div class="parts-toolbar"><input id="part-search" type="search" placeholder="Search part number, description, or EEE code" aria-label="Search parts"><span class="small muted">${suggested.length ? `${suggested.length} suggested` : "No suggested part"}</span></div>
      ${suggested.length ? `
        <ul class="parts-list">${suggested.map(([name, full], idx) => {
          const p = priceFor(d, issue, full, w.appleCare);
          return `<li>
            <input type="checkbox" id="part-${idx}" data-part="${esc(name)}" ${w.parts.has(name) ? "checked" : ""}>
            <label for="part-${idx}" style="margin:0;font-weight:400">
              <div class="p-name">${esc(name)}</div><div class="p-meta">${esc(p.why)}</div>
            </label>
            <div class="price">${p.pay !== full ? `<s>${money(full)}</s>` : ""}${money(p.pay)}</div>
          </li>`; }).join("")}</ul>
        <div class="total"><span>Customer pays (estimate)</span><span>${money(total)}</span></div>`
        : `<p>No physical part suggested. Adjustment outcomes can still be recorded in the notes.</p>`}
      ${issue.accidental && cov.tone !== "bad" && !w.appleCare
        ? `<p class="small" style="margin-top:12px"><span class="badge warn">Heads up</span> Accidental damage isn't covered by the limited warranty, so the customer pays full price.</p>` : ""}`;
    canNext = true;
  }

  if (w.step === 3) {
    const issue = issueById(w.issue) || ISSUES.find((i) => i.id === w.verifiedIssue) || ISSUES[0];
    const parts = (PARTS[d.kind][w.verifiedIssue || w.issue] || []).filter((p) => w.parts.has(p[0]));
    const total = parts.reduce((s, p) => s + priceFor(d, issue, p[1], w.appleCare).pay, 0);
    body = `
      <h2>Customer & submit</h2>
      <div class="grid two">
        <div>
          <div class="field"><label for="c-name">Customer name</label><input id="c-name" value="${esc(w.customer)}" autocomplete="name"></div>
          <div class="field"><label for="c-email">Email <span class="hint">— we'll send status updates here</span></label><input id="c-email" type="email" value="${esc(w.email)}" autocomplete="email"></div>
          <div class="grid two">
            <div class="field"><label for="c-phone">Phone</label><input id="c-phone" value="${esc(w.phone || "")}" autocomplete="tel"></div>
            <div class="field"><label for="c-address">Address</label><input id="c-address" value="${esc(w.address || "")}" autocomplete="street-address"></div>
          </div>
          <div class="field"><label for="received-at">Received date and time</label><input id="received-at" type="datetime-local" value="${esc(w.receivedAt || "")}"></div>
          <div class="field"><label for="c-notes">Customer intake notes <span class="hint" id="notes-count">0 / 400</span></label><textarea id="c-notes" maxlength="400" placeholder="What the customer told you">${esc(w.notes)}</textarea></div>
        </div>
        <div class="card" style="background:var(--surface-2);box-shadow:none">
          <h3>Summary</h3>
          <dl class="summary">
            <dt>Device</dt><dd>${esc(d.name)}<br><span class="mono small">${d.serial}</span></dd>
            <dt>Problem</dt><dd>${esc(issue.name)}</dd>
            <dt>Verified issue</dt><dd>${esc((CUSTOMER_ISSUES.find((i) => i.id === (w.verifiedIssue || w.issue)) || issue).name)}</dd>
            <dt>Repair</dt><dd>${esc(typeById(w.type).name)}</dd>
            <dt>Parts</dt><dd>${parts.length ? parts.map((p) => esc(p[0])).join("<br>") : "None"}</dd>
            <dt>AppleCare+</dt><dd>${w.appleCare ? "Customer confirmed" : "Customer does not have it"}</dd>
            <dt>Customer pays</dt><dd><strong>${money(total)}</strong></dd>
          </dl>
        </div>
      </div>`;
    canNext = true;
  }

  const last = w.step === WIZARD_STEPS.length - 1;
  main.innerHTML = `
    <p><a href="#/device/${d.serial}">← Back to ${esc(d.name)}</a></p>
    <div class="card">
      ${stepper}
      ${body}
      <div class="wizard-nav">
        ${w.step > 0 ? `<button class="btn" id="w-back">Back</button>` : ""}
        <span class="spacer"></span>
        <button class="btn primary" id="w-next" ${canNext ? "" : "disabled"}>${last ? "Create repair" : "Continue"}</button>
      </div>
    </div>`;

  main.querySelectorAll("[data-category]").forEach((b) => b.addEventListener("click", () => {
    w.issueCategory = b.dataset.category;
    renderWizard();
  }));
  main.querySelectorAll("[data-issue]").forEach((b) => b.addEventListener("click", () => {
    if (w.issue !== b.dataset.issue) { w.parts.clear(); w.partsTouched = false; }
    w.issue = b.dataset.issue;
    w.verifiedIssue = w.issue;
    w.step = 1;
    renderWizard();
  }));
  $("#use-reported")?.addEventListener("change", (e) => {
    w.useReported = e.target.checked;
    if (w.useReported) w.verifiedIssue = w.issue;
    renderWizard();
  });
  $("#verified-issue")?.addEventListener("change", (e) => {
    w.verifiedIssue = e.target.value;
    renderWizard();
  });
  main.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { w.type = b.dataset.type; renderWizard(); }));
  main.querySelectorAll("[data-part]").forEach((c) => c.addEventListener("change", () => {
    w.partsTouched = true;
    c.checked ? w.parts.add(c.dataset.part) : w.parts.delete(c.dataset.part);
    renderWizard();
  }));
  ["name", "email", "phone", "address", "notes"].forEach((f) => {
    const el = $("#c-" + f);
    if (el) el.addEventListener("input", () => {
      w[f === "name" ? "customer" : f] = el.value;
      if (f === "notes") $("#notes-count").textContent = `${el.value.length} / 400`;
    });
    $("#received-at")?.addEventListener("input", (e) => { w.receivedAt = e.target.value; });
  });
  if ($("#notes-count")) $("#notes-count").textContent = `${(w.notes || "").length} / 400`;

  $("#w-back")?.addEventListener("click", () => { w.step--; renderWizard(); });
  $("#w-next").addEventListener("click", () => {
    if (!last) { w.step++; return renderWizard(); }
    if (!w.customer.trim()) { $("#c-name").focus(); return toast("Add the customer's name to continue."); }
    if (!w.address?.trim()) { $("#c-address").focus(); return toast("Add the customer's address to continue."); }
    if (!/^\S+@\S+\.\S+$/.test(w.email)) { $("#c-email").focus(); return toast("Add a valid email so the customer gets updates."); }
    const issue = issueById(w.verifiedIssue || w.issue) || { accidental: false };
    const parts = (PARTS[d.kind][w.verifiedIssue || w.issue] || []).filter((p) => w.parts.has(p[0]));
    const repair = api.createRepair({
      serial: d.serial, issue: w.verifiedIssue || w.issue, type: w.type, customer: w.customer.trim(), email: w.email.trim(),
      phone: w.phone?.trim() || "", address: w.address.trim(), receivedAt: w.receivedAt || "", reportedIssue: w.issue,
      notes: w.notes.trim(), appleCare: w.appleCare,
      cost: parts.reduce((s, p) => s + priceFor(d, issue, p[1], w.appleCare).pay, 0),
    });
    state.wizard = null;
    toast(`Repair ${repair.id} created`);
    go("repair/" + repair.id);
  });
}

/* ---------- Repairs list ---------- */

const REPAIR_FILTERS = [
  { id: "active", name: "All open", test: (r) => r.status !== "closed" },
  { id: "open",   name: "Checked in", test: (r) => r.status === "open" },
  { id: "parts",  name: "Waiting on parts", test: (r) => r.status === "parts" },
  { id: "repair", name: "In repair", test: (r) => r.status === "repair" },
  { id: "pickup", name: "Ready for pickup", test: (r) => r.status === "pickup" },
  { id: "closed", name: "Closed", test: (r) => r.status === "closed" },
  { id: "all",    name: "Everything", test: () => true },
];

function renderRepairs() {
  main.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <h1 style="margin:0">Repairs</h1>
      <span class="spacer"></span>
      <input id="repair-q" type="search" placeholder="Filter by name, serial, or ID" aria-label="Filter repairs" value="${esc(state.repairQuery)}">
    </div>
    <div class="filters" role="group" aria-label="Filter by status">
      ${REPAIR_FILTERS.map((f) => `<button data-f="${f.id}" aria-pressed="${state.repairFilter === f.id}">${f.name} <span class="muted">${state.repairs.filter(f.test).length}</span></button>`).join("")}
    </div>
    <div class="card" style="padding:0"><div class="table-wrap" id="repair-table"></div></div>`;

  const drawTable = () => {
    const f = REPAIR_FILTERS.find((x) => x.id === state.repairFilter) || REPAIR_FILTERS[0];
    const q = state.repairQuery.trim().toLowerCase();
    const rows = state.repairs.filter(f.test).filter((r) => !q ||
      [r.id, r.serial, r.customer, deviceBySerial(r.serial).name].some((v) => v.toLowerCase().includes(q)));
    $("#repair-table").innerHTML = rows.length ? `
      <table>
        <thead><tr><th>Repair</th><th>Customer</th><th class="hide-sm">Device</th><th class="hide-sm">Problem</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr data-id="${r.id}" tabindex="0">
            <td class="mono">${r.id}<div class="small muted">${fmtDate(r.created)}</div></td>
            <td>${esc(r.customer)}</td>
            <td class="hide-sm">${esc(deviceBySerial(r.serial).name)}</td>
            <td class="hide-sm">${esc(issueById(r.issue).name)}</td>
            <td>${badge(r.status)}</td>
          </tr>`).join("")}</tbody>
      </table>` : `<div class="empty">No repairs here. <a href="#/home">Look up a device</a> to start one.</div>`;
    main.querySelectorAll("tr[data-id]").forEach((tr) => {
      const open = () => go("repair/" + tr.dataset.id);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    });
  };
  drawTable();

  main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { state.repairFilter = b.dataset.f; renderRepairs(); }));
  $("#repair-q").addEventListener("input", (e) => { state.repairQuery = e.target.value; drawTable(); });
}

function renderRepairDetail(id) {
  const r = api.findRepair(id);
  if (!r) return renderNotFound("We couldn't find that repair.");
  const d = deviceBySerial(r.serial);
  const idx = STATUSES.findIndex((s) => s.id === r.status);
  const s = STATUSES[idx];

  main.innerHTML = `
    <p><a href="#/repairs">← All repairs</a></p>
    <div class="row" style="margin-bottom:14px">
      <h1 style="margin:0">Repair <span class="mono">${r.id}</span></h1> ${badge(r.status)}
    </div>
    <div class="grid two">
      <div>
        ${s.next ? `
          <div class="next-step">
            <h3>Next step</h3>
            <p>${esc(s.help)}</p>
            <button class="btn primary" id="advance">${esc(s.next)}</button>
          </div>` : `<div class="next-step"><h3>All done</h3><p>This repair is closed.</p></div>`}
        <div class="card">
          <h2>Details</h2>
          <dl class="summary">
            <dt>Customer</dt><dd>${esc(r.customer)}<br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></dd>
            <dt>Device</dt><dd><a href="#/device/${d.serial}">${esc(d.name)}</a><br><span class="mono small">${d.serial}</span></dd>
            <dt>Problem</dt><dd>${esc(issueById(r.issue).name)}</dd>
            <dt>Repair type</dt><dd>${esc(typeById(r.type).name)}</dd>
            <dt>Parts</dt><dd>${r.parts.length ? r.parts.map((p) => esc(p[0])).join("<br>") : "None"}</dd>
            <dt>Customer pays</dt><dd><strong>${money(r.cost)}</strong></dd>
            ${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
          </dl>
        </div>
      </div>
      <div class="card">
        <h2>Progress</h2>
        <ul class="timeline">${STATUSES.map((st, i) => `
          <li class="${i < idx || r.status === "closed" ? "done" : i === idx ? "current" : ""}">
            <strong>${esc(st.name)}</strong>
            ${i === idx && r.status !== "closed" ? `<div class="when">Current step</div>` : ""}
            ${i === 0 ? `<div class="when">${fmtDate(r.created)}</div>` : ""}
          </li>`).join("")}</ul>
      </div>
    </div>`;

  $("#advance")?.addEventListener("click", () => {
    const updated = api.advanceRepair(r.id);
    toast(`Moved to "${statusById[updated.status].name}"`);
    renderRepairDetail(r.id);
    updateNavCounts();
  });
}

/* ---------- Parts & returns ---------- */

function returnsDue() {
  // Replaced parts must go back; a part is due once the repair has finished.
  return state.repairs
    .filter((r) => !r.returned && r.parts.length && ["pickup", "closed"].includes(r.status))
    .map((r) => {
      const due = new Date(new Date(r.created + "T12:00:00").getTime() + RETURN_WINDOW_DAYS * DAY).toISOString().slice(0, 10);
      return { repair: r, due, left: daysUntil(due) };
    })
    .sort((a, b) => a.left - b.left);
}

function renderParts() {
  const due = returnsDue();
  const onOrder = state.repairs.filter((r) => r.status === "parts");

  main.innerHTML = `
    <h1>Parts & returns</h1>
    <p class="muted">Two lists: parts you're waiting for, and old parts you need to send back.</p>

    <div class="card">
      <h2>Send these parts back</h2>
      <p class="small muted">Return replaced parts within ${RETURN_WINDOW_DAYS} days of the repair, or you may be charged for them.</p>
      ${due.length ? `<ul class="parts-list">${due.map(({ repair: r, due: d, left }) => `
        <li>
          <div>
            <div class="p-name">${r.parts.map((p) => esc(p[0])).join(", ")}</div>
            <div class="p-meta">From <a href="#/repair/${r.id}">${r.id}</a> · ${esc(r.customer)}</div>
          </div>
          <span class="spacer"></span>
          <span class="badge ${left < 0 ? "bad" : left <= 5 ? "warn" : ""}">${left < 0 ? `${-left} days late` : `Due in ${left} days`} · ${fmtDate(d)}</span>
          <button class="btn" data-return="${r.id}">Mark sent</button>
        </li>`).join("")}</ul>` : `<p class="empty">Nothing to send back. 🎉</p>`}
    </div>

    <div class="card">
      <h2>Waiting to arrive</h2>
      ${onOrder.length ? `<ul class="parts-list">${onOrder.map((r) => `
        <li>
          <div>
            <div class="p-name">${r.parts.map((p) => esc(p[0])).join(", ")}</div>
            <div class="p-meta">For <a href="#/repair/${r.id}">${r.id}</a> · ${esc(deviceBySerial(r.serial).name)}</div>
          </div>
          <span class="spacer"></span>
          <span class="badge warn">Ordered ${fmtDate(r.created)}</span>
        </li>`).join("")}</ul>` : `<p class="empty">No parts on order.</p>`}
    </div>`;

  main.querySelectorAll("[data-return]").forEach((b) => b.addEventListener("click", () => {
    api.markReturned(b.dataset.return);
    toast("Marked as sent back");
    renderParts();
    updateNavCounts();
  }));
}

/* ---------- Help ---------- */

const GLOSSARY = [
  ["Serial number", "A unique ID for each device. Find it in Settings → General → About, or printed on the device or box."],
  ["IMEI", "A 15-digit ID that iPhones and cellular iPads have. You can search with it instead of the serial."],
  ["Limited warranty", "Free repair of manufacturing defects for the first year. Doesn't cover accidental damage like drops or spills."],
  ["AppleCare+", "Coverage associated with the customer record for a specific serial number. Search the serial to retrieve the status, then confirm it with the customer before quoting accidental-damage pricing."],
  ["Carry-in", "You repair the device in your store."],
  ["Mail-in", "You ship the device to a repair center and they fix it."],
  ["Whole-unit replacement", "Instead of fixing one part, the customer gets a replacement device."],
  ["Component and issue codes", "Short codes that describe what broke. This app fills them in for you when you pick the problem in plain language."],
  ["Part return", "When you replace a part, the old one has to be sent back. The Parts & returns page shows what's due and when."],
  ["Diagnostics", "An automatic test that checks the battery, display and other hardware. Run it before starting a repair if you're not sure what's wrong."],
];

function renderHelp() {
  main.innerHTML = `
    <h1>Help & glossary</h1>
    <div class="card">
      <h2>How a repair works</h2>
      <ol class="steps-how">
        <li><strong>Look it up.</strong><br><span class="muted small">Type the serial, IMEI or repair ID in the search bar. Press <kbd>/</kbd> to jump there from anywhere.</span></li>
        <li><strong>Check coverage.</strong><br><span class="muted small">Green means covered, yellow means coverage ends soon, red means not covered.</span></li>
        <li><strong>Start a repair.</strong><br><span class="muted small">Pick the problem in plain words. Parts and prices are filled in for you.</span></li>
        <li><strong>Follow "Next step".</strong><br><span class="muted small">Each repair page has one button that moves it forward.</span></li>
      </ol>
    </div>
    <div class="card">
      <h2>What does this mean?</h2>
      ${GLOSSARY.map(([t, d]) => `<details><summary>${esc(t)}</summary><p>${esc(d)}</p></details>`).join("")}
    </div>
    <div class="card">
      <h2>Reset demo</h2>
      <p class="muted small">Puts the sample repairs back the way they started.</p>
      <button class="btn" id="reset">Reset demo data</button>
    </div>`;
  $("#reset").addEventListener("click", () => {
    state.repairs = structuredClone(SEED_REPAIRS);
    saveRepairs();
    updateNavCounts();
    toast("Demo data reset");
  });
}

function renderNotFound(msg) {
  main.innerHTML = `<div class="card empty"><h2>${esc(msg)}</h2><p>Check the number and try again.</p><a class="btn primary" href="#/home">Back to search</a></div>`;
}

/* ====================================================================
 * Global wiring
 * ==================================================================== */

$("#global-search").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#global-search-input");
  search(input.value);
  input.value = "";
  input.blur();
});

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "/" && !typing) { e.preventDefault(); $("#global-search-input").focus(); }
  if (e.key === "Escape") closeMenu();
});

const sidebar = $("#sidebar");
const menuBtn = $("#menu-btn");
function closeMenu() { sidebar.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
menuBtn.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", router);
router();
