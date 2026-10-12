/* Coverage and pricing rules. Pure functions: pass `now` explicitly in tests. */

export const DAY = 864e5;
export const COVERAGE_WARN_DAYS = 60;
export const PLAN_FEES = { mac: 99, watch: 69, iphone: 49, ipad: 49 };

/** YYYY-MM-DD in local time. */
export const isoDate = (date) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};
export const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
export const daysFromNow = (n, now = new Date()) => isoDate(addDays(now, n));

/** Whole calendar days from `now` to `iso`: 0 = today, -1 = yesterday. */
export function daysUntil(iso, now = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - start) / DAY);
}

export const fmtDate = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Coverage status for a device. Coverage runs through the end of `coverageEnd`. */
export function coverageOf(device, hasPlan = false, now = new Date()) {
  const left = daysUntil(device.coverageEnd, now);
  if (left < 0) {
    return { covered: false, plan: false, daysLeft: left, tone: "bad", ico: "✕", title: "Not covered", short: "Not covered",
      detail: `Coverage ended ${fmtDate(device.coverageEnd)}. The customer pays the full repair price.` };
  }
  const plan = hasPlan === true;
  const endingSoon = left <= COVERAGE_WARN_DAYS;
  const soon = endingSoon ? ` Coverage ends in ${left} day${left === 1 ? "" : "s"}, so book repairs soon.` : "";
  return {
    covered: true, plan, daysLeft: left, tone: endingSoon ? "warn" : "good", ico: "✓",
    short: plan ? "Protection plan" : "Warranty",
    title: plan ? "Covered by protection plan" : "Covered by limited warranty",
    detail: plan
      ? `Covered until ${fmtDate(device.coverageEnd)}. Defects are free; accidental damage has a small service fee.${soon}`
      : `Covered until ${fmtDate(device.coverageEnd)}. Defects are free; accidental damage is NOT covered.${soon}`,
  };
}

/** What the customer pays for one part, given the device's coverage and the issue. */
export function priceFor(device, issue, fullPrice, hasPlan = false, now = new Date()) {
  const cov = coverageOf(device, hasPlan, now);
  if (!cov.covered) return { pay: fullPrice, why: "Not covered" };
  if (!issue?.accidental) return { pay: 0, why: "Covered defect" };
  if (cov.plan) {
    const fee = PLAN_FEES[device.kind] ?? PLAN_FEES.iphone;
    return { pay: Math.min(fee, fullPrice), why: "Protection plan service fee" };
  }
  return { pay: fullPrice, why: "Accidental damage isn't covered" };
}

/** Prices a list of { name, price } parts; returns priced parts and the total. */
export function quote(device, issue, parts, hasPlan = false, now = new Date()) {
  const priced = parts.map((p) => ({ ...p, ...priceFor(device, issue, p.price, hasPlan, now) }));
  return { parts: priced, total: priced.reduce((sum, p) => sum + p.pay, 0) };
}
