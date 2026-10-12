import express from "express";
import { fileURLToPath } from "node:url";
import { REPAIR_TYPES, STATUSES, issueById, suggestedParts } from "../public/shared/catalog.js";
import { isoDate, quote } from "../public/shared/pricing.js";
import { deviceFromRow, insertRepair, repairFromRow, seed } from "./db.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const normalize = (s) => String(s ?? "").replace(/[\s-]/g, "").toUpperCase();
const EMAIL_RE = /^\S+@\S+\.\S+$/;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createApp(db, { now = () => new Date() } = {}) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  const findDevice = (q) => {
    const n = normalize(q);
    return deviceFromRow(db.prepare("SELECT * FROM devices WHERE serial = ? OR imei = ? OR imei2 = ?").get(n, n, n));
  };
  const findRepair = (id) => repairFromRow(db, db.prepare("SELECT * FROM repairs WHERE id = ?").get(normalize(id)));
  const mustFindRepair = (id) => {
    const r = findRepair(id);
    if (!r) throw new HttpError(404, "Repair not found");
    return r;
  };

  app.get("/api/devices", (_req, res) => {
    res.json(db.prepare("SELECT * FROM devices ORDER BY name").all().map(deviceFromRow));
  });

  app.get("/api/devices/:q", (req, res) => {
    const d = findDevice(req.params.q);
    if (!d) throw new HttpError(404, "Device not found");
    res.json(d);
  });

  app.get("/api/repairs", (_req, res) => {
    const rows = db.prepare("SELECT * FROM repairs ORDER BY created DESC, id DESC").all();
    res.json(rows.map((row) => repairFromRow(db, row)));
  });

  app.get("/api/repairs/:id", (req, res) => res.json(mustFindRepair(req.params.id)));

  app.post("/api/repairs", (req, res) => {
    const b = req.body ?? {};
    const text = (v, max = 400) => String(v ?? "").trim().slice(0, max);
    const device = findDevice(b.serial);
    if (!device) throw new HttpError(400, "Unknown device serial");
    const issue = issueById(b.issue);
    if (!issue || (issue.kinds && !issue.kinds.includes(device.kind))) throw new HttpError(400, "Issue doesn't apply to this device");
    const reported = b.reportedIssue ? issueById(b.reportedIssue) : issue;
    if (!reported) throw new HttpError(400, "Unknown reported issue");
    if (!REPAIR_TYPES.some((t) => t.id === b.type)) throw new HttpError(400, "Unknown repair type");
    const customer = text(b.customer, 120);
    const email = text(b.email, 200);
    const address = text(b.address, 300);
    if (!customer) throw new HttpError(400, "Customer name is required");
    if (!address) throw new HttpError(400, "Customer address is required");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required");

    // Parts and prices come from the catalog, never from the client.
    const wanted = new Set(Array.isArray(b.partNames) ? b.partNames : []);
    const chosen = suggestedParts(device.kind, issue.id).filter((p) => wanted.has(p.name));
    const protectionPlan = b.protectionPlan === true;
    const priced = quote(device, issue, chosen, protectionPlan, now());

    db.exec("BEGIN IMMEDIATE");
    let id;
    try {
      const { max } = db.prepare("SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) AS max FROM repairs").get();
      id = "R" + (Math.max(100000, max ?? 0) + 1);
      insertRepair(db, {
        id, serial: device.serial, issue: issue.id, reportedIssue: reported.id, type: b.type, customer, email,
        phone: text(b.phone, 40), address, reference: text(b.reference, 80), smsUpdates: b.smsUpdates === true,
        receivedAt: text(b.receivedAt, 40), notes: text(b.notes), techNotes: text(b.techNotes, 2000),
        protectionPlan, cost: priced.total, created: isoDate(now()),
        parts: priced.parts.map(({ name, price, pay }) => ({ name, price, pay })),
      });
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    res.status(201).json(findRepair(id));
  });

  app.post("/api/repairs/:id/advance", (req, res) => {
    const r = mustFindRepair(req.params.id);
    const i = STATUSES.findIndex((s) => s.id === r.status);
    if (i === STATUSES.length - 1) throw new HttpError(409, "Repair is already closed");
    db.prepare("UPDATE repairs SET status = ? WHERE id = ?").run(STATUSES[i + 1].id, r.id);
    res.json(findRepair(r.id));
  });

  app.post("/api/repairs/:id/returned", (req, res) => {
    const r = mustFindRepair(req.params.id);
    db.prepare("UPDATE repairs SET returned = 1 WHERE id = ?").run(r.id);
    res.json(findRepair(r.id));
  });

  app.post("/api/demo/reset", (_req, res) => {
    seed(db, now());
    res.status(204).end();
  });

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use(express.static(PUBLIC_DIR));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Something went wrong" : err.message });
  });

  return app;
}
