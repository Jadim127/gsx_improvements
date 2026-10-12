import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { openDb, seed } from "../server/db.js";

const db = openDb(":memory:");
let server, base;

before(async () => {
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => seed(db));

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

const newRepair = (overrides = {}) => ({
  serial: "HX7QW2M4PL9N", issue: "screen", type: "carry-in", partNames: ["Display"],
  customer: "Alex Kim", email: "alex@example.com", address: "1 Main St", ...overrides,
});

describe("devices", () => {
  test("finds a device by serial or IMEI, ignoring spaces, dashes and case", async () => {
    assert.equal((await call("GET", "/api/devices/hx7q-w2m4 pl9n")).body.serial, "HX7QW2M4PL9N");
    assert.equal((await call("GET", "/api/devices/356789104523799")).body.serial, "HX7QW2M4PL9N");
  });

  test("unknown device is a 404", async () => {
    assert.equal((await call("GET", "/api/devices/NOPE")).status, 404);
  });
});

describe("creating a repair", () => {
  test("saves the chosen parts and server-computed cost", async () => {
    const { status, body } = await call("POST", "/api/repairs", newRepair());
    assert.equal(status, 201);
    assert.equal(body.id, "R100232");
    assert.deepEqual(body.parts, [{ name: "Display", price: 329, pay: 329 }]); // accidental, no plan
    assert.equal(body.cost, 329);
    assert.equal(body.status, "open");

    const list = (await call("GET", "/api/repairs")).body;
    assert.ok(list.every((r) => Array.isArray(r.parts)));
    assert.deepEqual(list.find((r) => r.id === body.id).parts, body.parts);
  });

  test("applies the protection plan fee", async () => {
    const { body } = await call("POST", "/api/repairs", newRepair({ protectionPlan: true }));
    assert.equal(body.cost, 49);
  });

  test("ignores part names that aren't suggested for the issue", async () => {
    const { body } = await call("POST", "/api/repairs", newRepair({ partNames: ["Display", "Free iPhone"] }));
    assert.deepEqual(body.parts.map((p) => p.name), ["Display"]);
  });

  test("a repair with no parts gets an empty parts list", async () => {
    const { body } = await call("POST", "/api/repairs", newRepair({ issue: "wireless", partNames: [] }));
    assert.deepEqual(body.parts, []);
    assert.equal(body.cost, 0);
  });

  test("keeps the intake details", async () => {
    const { body } = await call("POST", "/api/repairs", newRepair({
      reportedIssue: "touch", phone: "555-0100", reference: "PO-7", smsUpdates: true, notes: "Dropped", techNotes: "Glass cracked",
    }));
    assert.equal(body.reportedIssue, "touch");
    assert.equal(body.phone, "555-0100");
    assert.equal(body.reference, "PO-7");
    assert.equal(body.smsUpdates, true);
    assert.equal(body.techNotes, "Glass cracked");
  });

  test("rejects invalid input", async () => {
    assert.equal((await call("POST", "/api/repairs", newRepair({ serial: "NOPE" }))).status, 400);
    assert.equal((await call("POST", "/api/repairs", newRepair({ issue: "keyboard" }))).status, 400); // mac-only
    assert.equal((await call("POST", "/api/repairs", newRepair({ type: "teleport" }))).status, 400);
    assert.equal((await call("POST", "/api/repairs", newRepair({ email: "nope" }))).status, 400);
    assert.equal((await call("POST", "/api/repairs", newRepair({ customer: "  " }))).status, 400);
    assert.equal((await call("POST", "/api/repairs", newRepair({ address: "" }))).status, 400);
  });
});

describe("repair lifecycle", () => {
  test("advances through statuses and refuses to advance past closed", async () => {
    const seen = [];
    for (let i = 0; i < 4; i++) seen.push((await call("POST", "/api/repairs/R100231/advance")).body.status);
    assert.deepEqual(seen, ["repair", "pickup", "closed", undefined]);
    assert.equal((await call("POST", "/api/repairs/R100198/advance")).status, 409);
  });

  test("marks parts returned", async () => {
    assert.equal((await call("POST", "/api/repairs/R100219/returned")).body.returned, true);
  });

  test("unknown repair is a 404", async () => {
    assert.equal((await call("GET", "/api/repairs/R1")).status, 404);
    assert.equal((await call("POST", "/api/repairs/R1/advance")).status, 404);
  });

  test("demo reset restores the seed repairs", async () => {
    await call("POST", "/api/repairs", newRepair());
    assert.equal((await call("POST", "/api/demo/reset")).status, 204);
    assert.equal((await call("GET", "/api/repairs")).body.length, 4);
  });
});
