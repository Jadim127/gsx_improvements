import { DatabaseSync } from "node:sqlite";
import { daysFromNow } from "../public/shared/pricing.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS devices (
    serial          TEXT PRIMARY KEY,
    imei            TEXT,
    imei2           TEXT,
    kind            TEXT NOT NULL CHECK (kind IN ('mac', 'iphone', 'ipad', 'watch')),
    name            TEXT NOT NULL,
    config          TEXT NOT NULL,
    purchased       TEXT NOT NULL,
    protection_plan INTEGER NOT NULL DEFAULT 0,
    coverage_end    TEXT NOT NULL,
    diag            TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS repairs (
    id              TEXT PRIMARY KEY,
    serial          TEXT NOT NULL REFERENCES devices(serial),
    issue           TEXT NOT NULL,
    reported_issue  TEXT,
    type            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    customer        TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    reference       TEXT NOT NULL DEFAULT '',
    sms_updates     INTEGER NOT NULL DEFAULT 0,
    received_at     TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    tech_notes      TEXT NOT NULL DEFAULT '',
    protection_plan INTEGER NOT NULL DEFAULT 0,
    cost            INTEGER NOT NULL DEFAULT 0,
    returned        INTEGER NOT NULL DEFAULT 0,
    created         TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS repair_parts (
    repair_id TEXT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    name      TEXT NOT NULL,
    price     INTEGER NOT NULL,
    pay       INTEGER NOT NULL,
    PRIMARY KEY (repair_id, position)
  );
  CREATE INDEX IF NOT EXISTS repairs_serial ON repairs(serial);
`;

// Demo data; all serials, IMEIs and customers are made up.
const seedDevices = (now) => [
  { serial: "C02XG1JHJG5J", kind: "mac", name: 'MacBook Pro 14"', config: "M3 Pro, 18GB, 512GB, Space Black",
    purchased: daysFromNow(-1050, now), protectionPlan: true, coverageEnd: daysFromNow(45, now),
    diag: { Battery: "pass", Display: "pass", Storage: "pass", Keyboard: "fail", Thermal: "pass" } },
  { serial: "F2LXK9ABCD12", imei: "353918104552210", kind: "iphone", name: "iPhone 15 Pro", config: "256GB, Natural Titanium",
    purchased: daysFromNow(-420, now), protectionPlan: false, coverageEnd: daysFromNow(-55, now),
    diag: { Battery: "fail", Display: "pass", Camera: "pass", Audio: "pass", Sensors: "pass" } },
  { serial: "HX7QW2M4PL9N", imei: "356789104523781", imei2: "356789104523799", kind: "iphone", name: "iPhone 16", config: "128GB, Black",
    purchased: daysFromNow(-190, now), protectionPlan: false, coverageEnd: daysFromNow(175, now),
    diag: { Battery: "pass", Display: "fail", Camera: "pass", Audio: "pass", Sensors: "pass" } },
  { serial: "DMPYH7Q2JF8K", kind: "ipad", name: 'iPad Air 11"', config: "M2, 128GB, Wi-Fi, Blue",
    purchased: daysFromNow(-300, now), protectionPlan: true, coverageEnd: daysFromNow(430, now),
    diag: { Battery: "pass", Display: "pass", Camera: "pass", Audio: "pass", Charging: "pass" } },
  { serial: "G6TZ3L0QW1MX", kind: "watch", name: "Apple Watch Series 9", config: "45mm, Aluminum, Midnight",
    purchased: daysFromNow(-800, now), protectionPlan: false, coverageEnd: daysFromNow(-435, now),
    diag: { Battery: "fail", Display: "pass", Sensors: "pass", Charging: "pass" } },
];

const part = (name, price, pay) => ({ name, price, pay });
const seedRepairs = (now) => [
  { id: "R100231", serial: "F2LXK9ABCD12", issue: "battery", type: "carry-in", status: "parts", customer: "Maya Torres", email: "maya@example.com",
    created: daysFromNow(-2, now), parts: [part("Battery", 99, 99)], cost: 99, notes: "Battery health 71%." },
  { id: "R100224", serial: "C02XG1JHJG5J", issue: "keyboard", type: "carry-in", status: "repair", customer: "Sam Lee", email: "sam@example.com",
    created: daysFromNow(-6, now), parts: [part("Top case with keyboard", 349, 0)], cost: 0, protectionPlan: true },
  { id: "R100219", serial: "G6TZ3L0QW1MX", issue: "battery", type: "mail-in", status: "pickup", customer: "Priya Shah", email: "priya@example.com",
    created: daysFromNow(-12, now), parts: [part("Battery service (unit swap)", 99, 99)], cost: 99 },
  { id: "R100198", serial: "DMPYH7Q2JF8K", issue: "screen", type: "swap", status: "closed", customer: "Jordan Park", email: "jordan@example.com",
    created: daysFromNow(-30, now), parts: [part("Whole-unit replacement", 399, 49)], cost: 49, protectionPlan: true, returned: true },
];

export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM devices").get();
  if (n === 0) seed(db);
  return db;
}

export function seed(db, now = new Date()) {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM repair_parts; DELETE FROM repairs; DELETE FROM devices;");
    const addDevice = db.prepare(`INSERT INTO devices (serial, imei, imei2, kind, name, config, purchased, protection_plan, coverage_end, diag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const d of seedDevices(now)) {
      addDevice.run(d.serial, d.imei ?? null, d.imei2 ?? null, d.kind, d.name, d.config, d.purchased,
        d.protectionPlan ? 1 : 0, d.coverageEnd, JSON.stringify(d.diag));
    }
    for (const r of seedRepairs(now)) insertRepair(db, r);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function insertRepair(db, r) {
  db.prepare(`INSERT INTO repairs (id, serial, issue, reported_issue, type, status, customer, email, phone, address, reference,
      sms_updates, received_at, notes, tech_notes, protection_plan, cost, returned, created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    r.id, r.serial, r.issue, r.reportedIssue ?? r.issue, r.type, r.status ?? "open", r.customer, r.email,
    r.phone ?? "", r.address ?? "", r.reference ?? "", r.smsUpdates ? 1 : 0, r.receivedAt ?? "",
    r.notes ?? "", r.techNotes ?? "", r.protectionPlan ? 1 : 0, r.cost, r.returned ? 1 : 0, r.created);
  const addPart = db.prepare("INSERT INTO repair_parts (repair_id, position, name, price, pay) VALUES (?, ?, ?, ?, ?)");
  r.parts.forEach((p, i) => addPart.run(r.id, i, p.name, p.price, p.pay));
}

export const deviceFromRow = (row) => row && ({
  serial: row.serial, imei: row.imei, imei2: row.imei2, kind: row.kind, name: row.name, config: row.config,
  purchased: row.purchased, protectionPlan: !!row.protection_plan, coverageEnd: row.coverage_end, diag: JSON.parse(row.diag),
});

export function repairFromRow(db, row) {
  if (!row) return null;
  const parts = db.prepare("SELECT name, price, pay FROM repair_parts WHERE repair_id = ? ORDER BY position").all(row.id);
  return {
    id: row.id, serial: row.serial, issue: row.issue, reportedIssue: row.reported_issue, type: row.type, status: row.status,
    customer: row.customer, email: row.email, phone: row.phone, address: row.address, reference: row.reference,
    smsUpdates: !!row.sms_updates, receivedAt: row.received_at, notes: row.notes, techNotes: row.tech_notes,
    protectionPlan: !!row.protection_plan, cost: row.cost, returned: !!row.returned, created: row.created,
    parts: parts.map((p) => ({ ...p })),
  };
}
