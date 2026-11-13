import assert from "node:assert/strict";
import test from "node:test";
import { formatPlannedContactDate } from "./format";

import { isContactOverdue, KEEP_IN_TOUCH_INTERVALS, nextContactDate } from "./keep-in-touch";

for (const interval of KEEP_IN_TOUCH_INTERVALS) {
  test(`${interval} days preserves the exact time`, () => {
    const now = new Date("2026-11-16T11:00:00.123Z");
    assert.equal(nextContactDate(now, interval).getTime() - now.getTime(), interval * 86_400_000);
    assert.equal(nextContactDate(now, interval).toISOString().slice(11), "11:00:00.123Z");
  });
}

test("the deadline is overdue strictly after its exact instant", () => {
  const deadline = new Date("2026-11-23T11:00:00Z");
  assert.equal(isContactOverdue(deadline, new Date(deadline.getTime() - 1)), false);
  assert.equal(isContactOverdue(deadline, deadline), false);
  assert.equal(isContactOverdue(deadline, new Date(deadline.getTime() + 1)), true);
  assert.equal(isContactOverdue(deadline, new Date("2026-11-23T12:00:00Z")), true);
});

test("fixed days cross a short month and a leap year", () => {
  assert.equal(nextContactDate(new Date("2027-02-01T11:00:00Z"), 30).toISOString(), "2027-03-03T11:00:00.000Z");
  assert.equal(nextContactDate(new Date("2028-02-01T11:00:00Z"), 30).toISOString(), "2028-03-02T11:00:00.000Z");
  assert.equal(nextContactDate(new Date("2028-02-29T11:00:00Z"), 365).toISOString(), "2029-02-28T11:00:00.000Z");
});

test("unsupported intervals are rejected", () => {
  for (const interval of [0, 1, 31, 366, NaN]) {
    assert.throws(() => nextContactDate(new Date(), interval));
  }
});

test("planned dates use Novosibirsk regardless of the system time zone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Novosibirsk"]) {
      process.env.TZ = zone;
      const date = new Date("2026-11-22T18:30:00Z");
      const formatted = formatPlannedContactDate(date);
      assert.match(formatted, /^23 ноября 2026/);
      assert.doesNotMatch(formatted, /\d:\d/);
      assert.equal(isContactOverdue(date, new Date("2026-11-22T19:00:00Z")), true);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
