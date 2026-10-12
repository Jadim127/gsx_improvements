import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coverageOf, daysUntil, priceFor, quote, PLAN_FEES } from "../public/shared/pricing.js";

const NOW = new Date(2026, 0, 15, 12, 0); // Jan 15 2026, noon local time
const device = (kind, coverageEnd) => ({ kind, coverageEnd });
const DEFECT = { id: "battery", accidental: false };
const ACCIDENT = { id: "screen", accidental: true };

describe("daysUntil", () => {
  test("counts whole calendar days regardless of time of day", () => {
    assert.equal(daysUntil("2026-01-15", NOW), 0);
    assert.equal(daysUntil("2026-01-16", NOW), 1);
    assert.equal(daysUntil("2026-01-14", NOW), -1);
    assert.equal(daysUntil("2026-01-14", new Date(2026, 0, 15, 0, 1)), -1);
    assert.equal(daysUntil("2026-01-16", new Date(2026, 0, 15, 23, 59)), 1);
  });

  test("handles month and year boundaries", () => {
    assert.equal(daysUntil("2026-02-01", NOW), 17);
    assert.equal(daysUntil("2025-12-31", NOW), -15);
  });
});

describe("coverageOf", () => {
  test("coverage that ended yesterday is not covered", () => {
    const cov = coverageOf(device("iphone", "2026-01-14"), false, NOW);
    assert.equal(cov.covered, false);
    assert.equal(cov.tone, "bad");
    assert.equal(cov.title, "Not covered");
  });

  test("coverage is still valid on its last day", () => {
    const cov = coverageOf(device("iphone", "2026-01-15"), false, NOW);
    assert.equal(cov.covered, true);
    assert.equal(cov.daysLeft, 0);
  });

  test("warns when 60 or fewer days remain", () => {
    assert.equal(coverageOf(device("mac", "2026-03-16"), false, NOW).tone, "warn"); // 60 days
    assert.equal(coverageOf(device("mac", "2026-03-17"), false, NOW).tone, "good"); // 61 days
  });

  test("ending-soon note uses the correct day count", () => {
    assert.match(coverageOf(device("mac", "2026-01-16"), false, NOW).detail, /ends in 1 day,/);
    assert.match(coverageOf(device("mac", "2026-01-25"), false, NOW).detail, /ends in 10 days,/);
    assert.doesNotMatch(coverageOf(device("mac", "2026-12-31"), false, NOW).detail, /ends in/);
  });

  test("labels limited warranty vs protection plan", () => {
    const warranty = coverageOf(device("ipad", "2026-12-31"), false, NOW);
    assert.equal(warranty.plan, false);
    assert.equal(warranty.short, "Warranty");
    assert.match(warranty.detail, /accidental damage is NOT covered/);

    const plan = coverageOf(device("ipad", "2026-12-31"), true, NOW);
    assert.equal(plan.plan, true);
    assert.equal(plan.short, "Protection plan");
  });

  test("only a literal true counts as having a plan", () => {
    assert.equal(coverageOf(device("ipad", "2026-12-31"), "yes", NOW).plan, false);
    assert.equal(coverageOf(device("ipad", "2026-12-31"), undefined, NOW).plan, false);
  });

  test("an expired device is not covered even with a plan", () => {
    assert.equal(coverageOf(device("ipad", "2025-06-01"), true, NOW).covered, false);
  });
});

describe("priceFor", () => {
  test("not covered: customer pays full price for anything", () => {
    const d = device("iphone", "2025-12-01");
    assert.deepEqual(priceFor(d, DEFECT, 99, false, NOW), { pay: 99, why: "Not covered" });
    assert.deepEqual(priceFor(d, ACCIDENT, 329, true, NOW), { pay: 329, why: "Not covered" });
  });

  test("covered defect is free, with or without a plan", () => {
    const d = device("mac", "2026-12-31");
    assert.equal(priceFor(d, DEFECT, 749, false, NOW).pay, 0);
    assert.equal(priceFor(d, DEFECT, 749, true, NOW).pay, 0);
  });

  test("a missing issue is treated as a covered defect", () => {
    assert.equal(priceFor(device("mac", "2026-12-31"), undefined, 749, false, NOW).pay, 0);
  });

  test("accidental damage under limited warranty pays full price", () => {
    assert.deepEqual(priceFor(device("iphone", "2026-12-31"), ACCIDENT, 329, false, NOW),
      { pay: 329, why: "Accidental damage isn't covered" });
  });

  test("accidental damage with a plan pays the per-device service fee", () => {
    for (const kind of ["mac", "iphone", "ipad", "watch"]) {
      const p = priceFor(device(kind, "2026-12-31"), ACCIDENT, 1000, true, NOW);
      assert.equal(p.pay, PLAN_FEES[kind], kind);
      assert.equal(p.why, "Protection plan service fee");
    }
  });

  test("service fee never exceeds the part's full price", () => {
    assert.equal(priceFor(device("mac", "2026-12-31"), ACCIDENT, 40, true, NOW).pay, 40);
  });

  test("coverage ending today still applies", () => {
    assert.equal(priceFor(device("iphone", "2026-01-15"), DEFECT, 99, false, NOW).pay, 0);
  });
});

describe("quote", () => {
  test("prices each part and totals what the customer pays", () => {
    const parts = [{ name: "Logic board", price: 749 }, { name: "Top case", price: 349 }];
    const q = quote(device("mac", "2026-12-31"), ACCIDENT, parts, true, NOW);
    assert.deepEqual(q.parts.map((p) => p.pay), [99, 99]);
    assert.equal(q.total, 198);
    assert.equal(q.parts[0].price, 749);
  });

  test("an empty part list costs nothing", () => {
    assert.equal(quote(device("mac", "2026-12-31"), ACCIDENT, [], true, NOW).total, 0);
  });
});
