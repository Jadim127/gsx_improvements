/* RepairDesk — a simplified front desk for repair lookups, repairs and parts.
 * All data is made up for the demo. The screens only talk to the `api` object,
 * which calls the REST backend in /server. */

import {
  ISSUE_CATEGORIES, REPAIR_TYPES, RETURN_WINDOW_DAYS, STATUSES,
  issueById, issuesFor, suggestedParts, typeById,
} from "./shared/catalog.js";
import { addDays, coverageOf, daysUntil, fmtDate, isoDate, quote } from "./shared/pricing.js";

const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

/* ====================================================================
 * API layer — REST calls to the backend
 * ==================================================================== */

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}
const orNullOn404 = (promise) => promise.catch((err) => { if (err.status === 404) return null; throw err; });

const api = {
  listDevices: () => request("GET", "/api/devices"),
  findDevice: (q) => orNullOn404(request("GET", "/api/devices/" + encodeURIComponent(q))),
  listRepairs: () => request("GET", "/api/repairs"),
  findRepair: (id) => orNullOn404(request("GET", "/api/repairs/" + encodeURIComponent(id))),
  createRepair: (data) => request("POST", "/api/repairs", data),
  advanceRepair: (id) => request("POST", `/api/repairs/${encodeURIComponent(id)}/advance`),
  markReturned: (id) => request("POST", `/api/repairs/${encodeURIComponent(id)}/returned`),
  resetDemo: () => request("POST", "/api/demo/reset"),
};

/* ====================================================================
 * Helpers
 * ==================================================================== */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + n.toLocaleString("en-US");
const deviceBySerial = (s) => state.devices.find((d) => d.serial === s);
const issueName = (id) => issueById(id)?.name ?? id;
const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

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

function replaceRepair(updated) {
  const i = state.repairs.findIndex((r) => r.id === updated.id);
  if (i >= 0) state.repairs[i] = updated; else state.repairs.unshift(updated);
}

/* ====================================================================
 * State & routing
 * ==================================================================== */

const state = {
  devices: [],
  repairs: [],
  recent: [],            // recently viewed serials
  planBySerial: {},      // protection-plan answers captured during the current lookup
  intakeBySerial: {},    // customer details typed on the device workbench
  diagRun: {},           // serials whose diagnostics ran this session
  repairFilter: "active",
  repairQuery: "",
  wizard: null,
};

const emptyIntake = () => ({ firstName: "", lastName: "", email: "", phone: "", reference: "", smsUpdates: false, address: "", notes: "", techNotes: "" });
const intakeFor = (serial) => (state.intakeBySerial[serial] ??= emptyIntake());
const intakeComplete = (i) => !!(i.firstName.trim() && i.lastName.trim() && i.address.trim() && /^\S+@\S+\.\S+$/.test(i.email));

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

async function router() {
  const [name = "home", arg] = location.hash.replace(/^#\/?/, "").split("/");
  try {
    state.repairs = await api.listRepairs();
  } catch (err) {
    return renderError(err);
  }
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
async function search(q) {
  if (!q.trim()) return;
  try {
    const device = await api.findDevice(q);
    if (device) return go("device/" + device.serial);
    const repair = await api.findRepair(q);
    if (repair) return go("repair/" + repair.id);
    toast(`Nothing found for "${q.trim()}". Check the number and try again.`);
  } catch (err) {
    toast(err.message);
  }
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
      <p class="muted">Enter a serial number, IMEI, or repair ID. The serial identifies the exact device and its coverage record.</p>
      <form class="hero-search" id="hero-search">
        <input id="hero-input" type="search" autocomplete="off" placeholder="e.g. C02XG1JHJG5J" aria-label="Serial number, IMEI, or repair ID" autofocus>
        <button class="btn primary big" type="submit">Look up</button>
      </form>
      <p class="small muted">Find the serial in the device's settings, or printed on the device or box.</p>
      <div class="chips" aria-label="Demo devices to try">
        <span class="small muted" style="align-self:center">Try:</span>
        ${state.devices.map((d) => `<button class="chip" data-serial="${esc(d.serial)}">${esc(d.name)}</button>`).join("")}
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
        ${state.recent.map((s) => `<button class="chip" data-serial="${esc(s)}">${esc(deviceBySerial(s)?.name)} · <span class="mono">${esc(s)}</span></button>`).join("")}
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

  const hasPlan = state.planBySerial[serial] ?? d.protectionPlan;
  const cov = coverageOf(d, hasPlan === true);
  const history = state.repairs.filter((r) => r.serial === serial);
  const openRepair = history.find((r) => r.status !== "closed");
  const intake = intakeFor(serial);
  const field = (key, label, type = "text", placeholder = "", cls = "") =>
    `<label${cls ? ` class="${cls}"` : ""}>${label}<input type="${type}" data-intake="${key}" value="${esc(intake[key])}" placeholder="${esc(placeholder)}"></label>`;

  main.innerHTML = `
    <div class="workbench-head">
      <a href="#/home">← New lookup</a>
      <span class="workbench-context">New repair · ${esc(d.name)}</span>
      <span class="spacer"></span>
      ${openRepair ? `<a class="btn" href="#/repair/${esc(openRepair.id)}">Open ${esc(openRepair.id)}</a>` : ""}
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
          <div><dt>Serial number</dt><dd class="mono">${esc(d.serial)}</dd></div>
          ${d.imei ? `<div><dt>IMEI</dt><dd class="mono">${esc(d.imei)}</dd></div>` : ""}
          ${d.imei2 ? `<div><dt>IMEI 2</dt><dd class="mono">${esc(d.imei2)}</dd></div>` : ""}
          <div><dt>Purchased</dt><dd>${fmtDate(d.purchased)}</dd></div>
          <div><dt>Coverage ends</dt><dd>${fmtDate(d.coverageEnd)}</dd></div>
        </dl>
        <div class="coverage-question">
          <strong>Protection plan for this serial</strong>
          <span class="small muted">${hasPlan === true ? "Found on the coverage record. Confirm with the customer." : "No protection plan found on the coverage record. Confirm with the customer."}</span>
          <div class="answer-buttons" role="group" aria-label="Protection plan">
            <button class="btn ${hasPlan === true ? "selected" : ""}" data-plan="yes" aria-pressed="${hasPlan === true}">Yes</button>
            <button class="btn ${hasPlan === false ? "selected" : ""}" data-plan="no" aria-pressed="${hasPlan === false}">No</button>
          </div>
        </div>
      </section>
      <section class="card workbench-customer">
        <div class="panel-title"><h2>Customer</h2><span class="panel-status" id="intake-status"></span></div>
        <div class="customer-fields">
          ${field("firstName", "First name", "text", "First name")}
          ${field("lastName", "Last name", "text", "Last name")}
          ${field("email", "Email", "email", "customer@example.com")}
          ${field("phone", "Phone number", "tel", "(555) 555-0123")}
          ${field("reference", "Purchase order / reference", "text", "Optional reference")}
          <label class="sms-field"><input type="checkbox" data-intake="smsUpdates" ${intake.smsUpdates ? "checked" : ""}> SMS update</label>
          ${field("address", "Address", "text", "Street, city, state, ZIP", "wide")}
          <label class="wide">Customer intake notes<textarea rows="2" data-intake="notes" maxlength="400" placeholder="What did the customer report?">${esc(intake.notes)}</textarea></label>
        </div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Diagnostics</h2><button class="btn small-btn" id="run-diag">Run diagnostics</button></div>
        <div id="diag-body"><p class="muted small">Run a quick check to help identify the issue.</p></div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Repair details</h2>${openRepair ? badge(openRepair.status) : `<span class="panel-status">Not started</span>`}</div>
        ${openRepair ? `<p class="small"><strong>${esc(issueName(openRepair.issue))}</strong><br><a href="#/repair/${esc(openRepair.id)}">${esc(openRepair.id)}</a> · ${esc(typeById(openRepair.type)?.name)}</p>` : `<p class="muted small">Choose an issue and repair type to see the work order here.</p>`}
        <div class="panel-action"><button class="btn" id="repair-details-action">${openRepair ? "View repair details" : "Choose issue"}</button></div>
      </section>
      <section class="card workbench-panel">
        <div class="panel-title"><h2>Parts</h2><span class="panel-status">${openRepair ? `${openRepair.parts.length} selected` : "None selected"}</span></div>
        ${openRepair?.parts.length ? `<ul class="compact-list">${openRepair.parts.map((p) => `<li><span>${esc(p.name)}</span><strong>${money(p.pay)}</strong></li>`).join("")}</ul>` : `<p class="empty">No part added yet.</p>`}
        <div class="panel-action"><button class="btn" id="parts-action">${openRepair ? "View parts" : "Add parts after issue"}</button></div>
      </section>
      <section class="card workbench-panel notes-panel">
        <div class="panel-title"><h2>Notes</h2><span class="panel-status">Internal</span></div>
        <label class="sr-only" for="tech-notes">Technician notes</label>
        <textarea id="tech-notes" rows="4" data-intake="techNotes" placeholder="Add technician notes">${esc(intake.techNotes)}</textarea>
        <p class="small muted">Notes are saved with the repair when you create it.</p>
      </section>
    </div>
    <div class="workbench-nav" aria-label="Repair workspace sections">
      <span class="active">Overview</span><span id="nav-customer"></span><span>Diagnostics · ${state.diagRun[serial] ? "Done" : "Not run"}</span><span>Repair details · ${openRepair ? "Done" : "Incomplete"}</span>
    </div>
    <div class="workbench-next" id="workbench-next"></div>
  `;

  const refreshIntakeStatus = () => {
    const done = intakeComplete(intake);
    $("#intake-status").textContent = done ? "Ready" : "Required for intake";
    $("#nav-customer").textContent = `Customer · ${done ? "Done" : "Incomplete"}`;
    $("#workbench-next").innerHTML = openRepair
      ? `Next step: Review the existing repair <span class="muted">${esc(openRepair.id)} is still open for this device.</span>`
      : done
        ? `Next step: Start the repair <span class="muted">Customer details will carry into the repair.</span>`
        : `Next step: Enter customer information <span class="muted">Name, email and address are needed to create a repair.</span>`;
  };
  refreshIntakeStatus();

  main.querySelectorAll("[data-intake]").forEach((el) => {
    const key = el.dataset.intake;
    el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
      intake[key] = el.type === "checkbox" ? el.checked : el.value;
      refreshIntakeStatus();
    });
  });

  const startWizard = () => {
    state.wizard = {
      serial, protectionPlan: hasPlan === true, step: 0, issueCategory: null,
      issue: null, verifiedIssue: null, useReported: true, type: null, parts: new Set(), partsTouched: false,
      customer: `${intake.firstName.trim()} ${intake.lastName.trim()}`.trim(), email: intake.email.trim(),
      phone: intake.phone.trim(), address: intake.address.trim(), reference: intake.reference.trim(),
      smsUpdates: intake.smsUpdates, notes: intake.notes, techNotes: intake.techNotes, receivedAt: "",
    };
    go("new");
  };
  $("#start-repair").addEventListener("click", startWizard);
  $("#repair-details-action").addEventListener("click", () => openRepair ? go("repair/" + openRepair.id) : startWizard());
  $("#parts-action").addEventListener("click", () => openRepair ? go("repair/" + openRepair.id) : startWizard());
  $("#run-diag").addEventListener("click", () => runDiagnostics(d));
  main.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", () => {
    state.planBySerial[serial] = button.dataset.plan === "yes";
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
    state.diagRun[d.serial] = true;
    const failed = tests.filter((t) => d.diag[t] === "fail");
    body.innerHTML = `
      <ul class="diag-list">${tests.map((t) => `<li><span>${esc(t)}</span>${d.diag[t] === "pass"
        ? `<span class="badge good">Passed</span>` : `<span class="badge bad">Needs attention</span>`}</li>`).join("")}</ul>
      <p class="small" style="margin-top:12px">${failed.length
        ? `<strong>${esc(failed.join(", "))}</strong> failed. Start a repair and pick the matching issue.`
        : "Everything passed. If the customer still sees a problem, describe it in the repair notes."}</p>`;
  }, 450);
}

/* ---------- New repair wizard ---------- */

const WIZARD_STEPS = ["Customer issue", "Repair details", "Parts & notes", "Customer & submit"];

function renderWizard() {
  const w = state.wizard;
  if (!w) return go("home");
  const d = deviceBySerial(w.serial);
  if (!d) return renderNotFound("We couldn't find that device.");
  const issues = issuesFor(d.kind);
  const verifiedId = w.useReported ? w.issue : (w.verifiedIssue || w.issue);
  const verified = issueById(verifiedId);
  const priced = verified
    ? quote(d, verified, suggestedParts(d.kind, verified.id), w.protectionPlan)
    : { parts: [], total: 0 };
  if (w.step >= 2 && w.parts.size === 0 && !w.partsTouched) priced.parts.forEach((p) => w.parts.add(p.name));
  const chosen = priced.parts.filter((p) => w.parts.has(p.name));
  const total = chosen.reduce((sum, p) => sum + p.pay, 0);

  const stepper = `<ol class="stepper">${WIZARD_STEPS.map((s, i) =>
    `<li class="${i < w.step ? "done" : i === w.step ? "current" : ""}" ${i === w.step ? 'aria-current="step"' : ""}>${s}</li>`).join("")}</ol>`;

  let body = "";
  let canNext = false;

  if (w.step === 0) {
    const failing = Object.keys(d.diag).filter((t) => d.diag[t] === "fail").join(", ");
    const categories = ISSUE_CATEGORIES
      .map((c) => ({ ...c, issues: issues.filter((i) => i.category === c.id) }))
      .filter((c) => c.issues.length);
    const selected = categories.find((c) => c.id === (w.issueCategory || issueById(w.issue)?.category)) || categories[0];
    body = `
      <h2>Customer reported issue</h2>
      <p class="muted">Choose a category, then the issue the customer described.${failing ? ` Diagnostics flagged: <strong>${esc(failing)}</strong>.` : ""}</p>
      <div class="issue-picker">
        <div class="issue-categories">
          ${categories.map((c) => `<button class="issue-category ${c.id === selected.id ? "selected" : ""}" data-category="${c.id}"><span>${esc(c.name)}</span><code>${c.code}</code></button>`).join("")}
        </div>
        <div class="issue-options">
          <div class="panel-title"><strong>${esc(selected.name)}</strong><span class="panel-status">${selected.issues.length} option${selected.issues.length === 1 ? "" : "s"}</span></div>
          ${selected.issues.map((i) => `<button class="issue-option ${w.issue === i.id ? "selected" : ""}" data-issue="${i.id}" title="${esc(i.hint)}"><span>${esc(i.name)}</span><code>(${esc(i.code)})</code></button>`).join("")}
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
      <label class="check-row"><input type="checkbox" id="use-reported" ${w.useReported ? "checked" : ""}> Same as the customer reported issue</label>
      <div class="field"><label for="verified-issue">Technician verified issue</label>
        <select id="verified-issue" ${w.useReported ? "disabled" : ""}>${ISSUE_CATEGORIES.map((c) => {
          const group = issues.filter((i) => i.category === c.id);
          return group.length ? `<optgroup label="${esc(c.name)}">${group.map((i) =>
            `<option value="${i.id}" ${verifiedId === i.id ? "selected" : ""}>${esc(i.name)} (${esc(i.code)})</option>`).join("")}</optgroup>` : "";
        }).join("")}</select>
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
    const cov = coverageOf(d, w.protectionPlan);
    body = `
      <h2>Parts & notes</h2>
      <p class="muted">These parts usually fix "${esc(verified.name.toLowerCase())}". Prices already include coverage
        (<span class="badge ${cov.tone}">${esc(cov.short)}</span>).</p>
      ${priced.parts.length ? `
        <ul class="parts-list">${priced.parts.map((p, idx) => `<li>
            <input type="checkbox" id="part-${idx}" data-part="${esc(p.name)}" ${w.parts.has(p.name) ? "checked" : ""}>
            <label for="part-${idx}" style="margin:0;font-weight:400">
              <div class="p-name">${esc(p.name)}</div><div class="p-meta">${esc(p.why)}</div>
            </label>
            <div class="price">${p.pay !== p.price ? `<s>${money(p.price)}</s>` : ""}${money(p.pay)}</div>
          </li>`).join("")}</ul>
        <div class="total"><span>Customer pays (estimate)</span><span>${money(total)}</span></div>`
        : `<p>No physical part suggested. Adjustment outcomes can still be recorded in the notes.</p>`}
      ${verified.accidental && cov.covered && !cov.plan
        ? `<p class="small" style="margin-top:12px"><span class="badge warn">Heads up</span> Accidental damage isn't covered by the limited warranty, so the customer pays full price.</p>` : ""}
      <div class="field" style="margin-top:16px"><label for="w-tech-notes">Technician notes <span class="hint">— internal</span></label><textarea id="w-tech-notes" rows="3">${esc(w.techNotes)}</textarea></div>`;
    canNext = true;
  }

  if (w.step === 3) {
    const reported = issueById(w.issue);
    body = `
      <h2>Customer & submit</h2>
      <div class="grid two">
        <div>
          <div class="field"><label for="c-name">Customer name</label><input id="c-name" value="${esc(w.customer)}" autocomplete="name"></div>
          <div class="field"><label for="c-email">Email <span class="hint">— we'll send status updates here</span></label><input id="c-email" type="email" value="${esc(w.email)}" autocomplete="email"></div>
          <div class="grid two">
            <div class="field"><label for="c-phone">Phone</label><input id="c-phone" value="${esc(w.phone)}" autocomplete="tel"></div>
            <div class="field"><label for="c-address">Address</label><input id="c-address" value="${esc(w.address)}" autocomplete="street-address"></div>
          </div>
          <div class="field"><label for="c-receivedAt">Received date and time</label><input id="c-receivedAt" type="datetime-local" value="${esc(w.receivedAt)}"></div>
          <div class="field"><label for="c-notes">Customer intake notes <span class="hint" id="notes-count"></span></label><textarea id="c-notes" maxlength="400" placeholder="What the customer told you">${esc(w.notes)}</textarea></div>
        </div>
        <div class="card" style="background:var(--surface-2);box-shadow:none">
          <h3>Summary</h3>
          <dl class="summary">
            <dt>Device</dt><dd>${esc(d.name)}<br><span class="mono small">${esc(d.serial)}</span></dd>
            <dt>Reported issue</dt><dd>${esc(reported.name)} <span class="mono small">${esc(reported.code)}</span></dd>
            <dt>Verified issue</dt><dd>${esc(verified.name)} <span class="mono small">${esc(verified.code)}</span></dd>
            <dt>Repair</dt><dd>${esc(typeById(w.type).name)}</dd>
            <dt>Parts</dt><dd>${chosen.length ? chosen.map((p) => esc(p.name)).join("<br>") : "None"}</dd>
            <dt>Protection plan</dt><dd>${w.protectionPlan ? "Customer confirmed" : "Customer does not have one"}</dd>
            ${w.reference ? `<dt>Reference</dt><dd>${esc(w.reference)}</dd>` : ""}
            <dt>Customer pays</dt><dd><strong>${money(total)}</strong></dd>
          </dl>
        </div>
      </div>`;
    canNext = true;
  }

  const last = w.step === WIZARD_STEPS.length - 1;
  main.innerHTML = `
    <p><a href="#/device/${esc(d.serial)}">← Back to ${esc(d.name)}</a></p>
    <div class="card">
      ${stepper}
      ${body}
      <div class="wizard-nav">
        ${w.step > 0 ? `<button class="btn" id="w-back">Back</button>` : ""}
        <span class="spacer"></span>
        <button class="btn primary" id="w-next" ${canNext ? "" : "disabled"}>${last ? "Create repair" : "Continue"}</button>
      </div>
    </div>`;

  const resetParts = () => { w.parts.clear(); w.partsTouched = false; };

  main.querySelectorAll("[data-category]").forEach((b) => b.addEventListener("click", () => {
    w.issueCategory = b.dataset.category;
    renderWizard();
  }));
  main.querySelectorAll("[data-issue]").forEach((b) => b.addEventListener("click", () => {
    if (w.issue !== b.dataset.issue) resetParts();
    w.issue = b.dataset.issue;
    w.verifiedIssue = w.issue;
    w.useReported = true;
    w.step = 1;
    renderWizard();
  }));
  $("#use-reported")?.addEventListener("change", (e) => {
    w.useReported = e.target.checked;
    if (w.useReported && w.verifiedIssue !== w.issue) { w.verifiedIssue = w.issue; resetParts(); }
    renderWizard();
  });
  $("#verified-issue")?.addEventListener("change", (e) => {
    if (w.verifiedIssue !== e.target.value) resetParts();
    w.verifiedIssue = e.target.value;
    renderWizard();
  });
  main.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { w.type = b.dataset.type; renderWizard(); }));
  main.querySelectorAll("[data-part]").forEach((c) => c.addEventListener("change", () => {
    w.partsTouched = true;
    c.checked ? w.parts.add(c.dataset.part) : w.parts.delete(c.dataset.part);
    renderWizard();
  }));
  $("#w-tech-notes")?.addEventListener("input", (e) => { w.techNotes = e.target.value; });
  [["name", "customer"], ["email", "email"], ["phone", "phone"], ["address", "address"], ["receivedAt", "receivedAt"], ["notes", "notes"]].forEach(([id, key]) => {
    $("#c-" + id)?.addEventListener("input", (e) => {
      w[key] = e.target.value;
      if (key === "notes") $("#notes-count").textContent = `${w.notes.length} / 400`;
    });
  });
  if ($("#notes-count")) $("#notes-count").textContent = `${w.notes.length} / 400`;

  $("#w-back")?.addEventListener("click", () => { w.step--; renderWizard(); });
  $("#w-next").addEventListener("click", async (e) => {
    if (!last) { w.step++; return renderWizard(); }
    if (!w.customer.trim()) { $("#c-name").focus(); return toast("Add the customer's name to continue."); }
    if (!w.address.trim()) { $("#c-address").focus(); return toast("Add the customer's address to continue."); }
    if (!/^\S+@\S+\.\S+$/.test(w.email.trim())) { $("#c-email").focus(); return toast("Add a valid email so the customer gets updates."); }
    e.currentTarget.disabled = true;
    try {
      const repair = await api.createRepair({
        serial: d.serial, issue: verified.id, reportedIssue: w.issue, type: w.type,
        partNames: chosen.map((p) => p.name), protectionPlan: w.protectionPlan,
        customer: w.customer, email: w.email, phone: w.phone, address: w.address, reference: w.reference,
        smsUpdates: w.smsUpdates, receivedAt: w.receivedAt, notes: w.notes, techNotes: w.techNotes,
      });
      state.wizard = null;
      delete state.intakeBySerial[d.serial];
      replaceRepair(repair);
      toast(`Repair ${repair.id} created`);
      go("repair/" + repair.id);
    } catch (err) {
      $("#w-next").disabled = false;
      toast(err.message);
    }
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
      [r.id, r.serial, r.customer, deviceBySerial(r.serial)?.name ?? ""].some((v) => v.toLowerCase().includes(q)));
    $("#repair-table").innerHTML = rows.length ? `
      <table>
        <thead><tr><th>Repair</th><th>Customer</th><th class="hide-sm">Device</th><th class="hide-sm">Problem</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr data-id="${esc(r.id)}" tabindex="0">
            <td class="mono">${esc(r.id)}<div class="small muted">${fmtDate(r.created)}</div></td>
            <td>${esc(r.customer)}</td>
            <td class="hide-sm">${esc(deviceBySerial(r.serial)?.name)}</td>
            <td class="hide-sm">${esc(issueName(r.issue))}</td>
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
  const r = state.repairs.find((x) => x.id === id);
  if (!r) return renderNotFound("We couldn't find that repair.");
  const d = deviceBySerial(r.serial);
  const idx = STATUSES.findIndex((s) => s.id === r.status);
  const s = STATUSES[idx];

  main.innerHTML = `
    <p><a href="#/repairs">← All repairs</a></p>
    <div class="row" style="margin-bottom:14px">
      <h1 style="margin:0">Repair <span class="mono">${esc(r.id)}</span></h1> ${badge(r.status)}
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
            <dt>Customer</dt><dd>${esc(r.customer)}<br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone ? `<br>${esc(r.phone)}` : ""}${r.smsUpdates ? ` <span class="small muted">(SMS updates)</span>` : ""}</dd>
            ${r.address ? `<dt>Address</dt><dd>${esc(r.address)}</dd>` : ""}
            <dt>Device</dt><dd><a href="#/device/${esc(r.serial)}">${esc(d?.name ?? r.serial)}</a><br><span class="mono small">${esc(r.serial)}</span></dd>
            ${r.reportedIssue && r.reportedIssue !== r.issue ? `<dt>Reported</dt><dd>${esc(issueName(r.reportedIssue))}</dd>` : ""}
            <dt>Problem</dt><dd>${esc(issueName(r.issue))}</dd>
            <dt>Repair type</dt><dd>${esc(typeById(r.type)?.name)}</dd>
            <dt>Parts</dt><dd>${r.parts.length ? r.parts.map((p) => `${esc(p.name)} <span class="small muted">${money(p.pay)}</span>`).join("<br>") : "None"}</dd>
            <dt>Customer pays</dt><dd><strong>${money(r.cost)}</strong></dd>
            ${r.reference ? `<dt>Reference</dt><dd>${esc(r.reference)}</dd>` : ""}
            ${r.notes ? `<dt>Customer notes</dt><dd>${esc(r.notes)}</dd>` : ""}
            ${r.techNotes ? `<dt>Tech notes</dt><dd>${esc(r.techNotes)}</dd>` : ""}
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

  $("#advance")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const updated = await api.advanceRepair(r.id);
      replaceRepair(updated);
      toast(`Moved to "${statusById[updated.status].name}"`);
    } catch (err) {
      toast(err.message);
    }
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
      const due = isoDate(addDays(new Date(r.created + "T12:00:00"), RETURN_WINDOW_DAYS));
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
            <div class="p-name">${r.parts.map((p) => esc(p.name)).join(", ")}</div>
            <div class="p-meta">From <a href="#/repair/${esc(r.id)}">${esc(r.id)}</a> · ${esc(r.customer)}</div>
          </div>
          <span class="spacer"></span>
          <span class="badge ${left < 0 ? "bad" : left <= 5 ? "warn" : ""}">${left < 0 ? `${-left} days late` : `Due in ${left} days`} · ${fmtDate(d)}</span>
          <button class="btn" data-return="${esc(r.id)}">Mark sent</button>
        </li>`).join("")}</ul>` : `<p class="empty">Nothing to send back. 🎉</p>`}
    </div>

    <div class="card">
      <h2>Waiting to arrive</h2>
      ${onOrder.length ? `<ul class="parts-list">${onOrder.map((r) => `
        <li>
          <div>
            <div class="p-name">${r.parts.length ? r.parts.map((p) => esc(p.name)).join(", ") : "No parts listed"}</div>
            <div class="p-meta">For <a href="#/repair/${esc(r.id)}">${esc(r.id)}</a> · ${esc(deviceBySerial(r.serial)?.name)}</div>
          </div>
          <span class="spacer"></span>
          <span class="badge warn">Ordered ${fmtDate(r.created)}</span>
        </li>`).join("")}</ul>` : `<p class="empty">No parts on order.</p>`}
    </div>`;

  main.querySelectorAll("[data-return]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      replaceRepair(await api.markReturned(b.dataset.return));
      toast("Marked as sent back");
    } catch (err) {
      toast(err.message);
    }
    renderParts();
    updateNavCounts();
  }));
}

/* ---------- Help ---------- */

const GLOSSARY = [
  ["Serial number", "A unique ID for each device. Find it in the device's settings, or printed on the device or box."],
  ["IMEI", "A 15-digit ID that phones and cellular tablets have. You can search with it instead of the serial."],
  ["Limited warranty", "Free repair of manufacturing defects for the first year. Doesn't cover accidental damage like drops or spills."],
  ["Protection plan", "Extended coverage tied to a specific serial number. Search the serial to see the status, then confirm it with the customer before quoting accidental-damage pricing."],
  ["Carry-in", "You repair the device in your store."],
  ["Mail-in", "You ship the device to a partner repair center and they fix it."],
  ["Whole-unit replacement", "Instead of fixing one part, the customer gets a replacement device."],
  ["Issue codes", "Short codes (like DSP-01) that describe what broke. This app fills them in when you pick the problem in plain language."],
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
  $("#reset").addEventListener("click", async () => {
    try {
      await api.resetDemo();
      [state.devices, state.repairs] = await Promise.all([api.listDevices(), api.listRepairs()]);
      updateNavCounts();
      toast("Demo data reset");
    } catch (err) {
      toast(err.message);
    }
  });
}

function renderNotFound(msg) {
  main.innerHTML = `<div class="card empty"><h2>${esc(msg)}</h2><p>Check the number and try again.</p><a class="btn primary" href="#/home">Back to search</a></div>`;
}

function renderError(err) {
  main.innerHTML = `<div class="card empty"><h2>Can't reach the server</h2><p>${esc(err.message)}</p><button class="btn primary" id="retry">Try again</button></div>`;
  $("#retry").addEventListener("click", start);
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

async function start() {
  try {
    state.devices = await api.listDevices();
  } catch (err) {
    return renderError(err);
  }
  router();
}

window.addEventListener("hashchange", router);
start();
