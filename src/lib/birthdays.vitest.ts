import { expect, test } from "vitest";

import { findUpcomingBirthdays } from "./birthdays";

function contact(id: number, birthMonth: number, birthDay: number) {
  return { id, name: `Contact ${id}`, birthMonth, birthDay };
}

test("includes today and the next seven dates, closest first", () => {
  const contacts = [
    contact(4, 5, 18), contact(2, 5, 11), contact(5, 5, 19),
    contact(1, 5, 10), contact(3, 5, 12),
  ];
  const birthdays = findUpcomingBirthdays(contacts, new Date("2026-05-11T05:00:00Z"));

  expect(birthdays.map(({ id }) => id)).toEqual([2, 3, 4]);
});

test("includes every contact with a shared birthday exactly once", () => {
  const contacts = [
    { ...contact(3, 5, 12), birthYear: 1980 },
    { ...contact(1, 5, 12), birthYear: null },
    { ...contact(2, 5, 12), birthYear: 1990 },
  ];
  const birthdays = findUpcomingBirthdays(contacts, new Date("2026-05-11T05:00:00Z"));

  expect(birthdays.map(({ id }) => id)).toEqual([1, 2, 3]);
});

test("orders December and January dates across New Year", () => {
  const contacts = [contact(1, 1, 1), contact(2, 12, 31), contact(3, 1, 4)];
  const birthdays = findUpcomingBirthdays(contacts, new Date("2026-12-28T05:00:00Z"));

  expect(birthdays.map(({ date }) => date.toISOString().slice(0, 10)))
    .toEqual(["2026-12-31", "2027-01-01", "2027-01-04"]);
});

test("changes the window at midnight in Novosibirsk", () => {
  const contacts = [contact(1, 5, 11), contact(2, 5, 12), contact(3, 5, 19)];
  const beforeMidnight = findUpcomingBirthdays(contacts, new Date("2026-05-11T16:59:59Z"));
  const afterMidnight = findUpcomingBirthdays(contacts, new Date("2026-05-11T17:00:00Z"));

  expect(beforeMidnight.map(({ id }) => id)).toEqual([1, 2]);
  expect(afterMidnight.map(({ id }) => id)).toEqual([2, 3]);
});

test("includes February 29 in the window of a leap year", () => {
  const birthdays = findUpcomingBirthdays([contact(1, 2, 29)], new Date("2028-02-27T05:00:00Z"));

  expect(birthdays).toEqual([{ id: 1, name: "Contact 1", date: new Date("2028-02-29T00:00:00Z") }]);
});

test("skips February 29 in a non-leap year without shifting it", () => {
  const contacts = [contact(1, 2, 29), contact(2, 2, 28), contact(3, 3, 1)];
  const birthdays = findUpcomingBirthdays(contacts, new Date("2027-02-27T05:00:00Z"));

  expect(birthdays.map(({ id }) => id)).toEqual([2, 3]);
});
