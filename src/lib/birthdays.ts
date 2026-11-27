import type { Contact } from "@/db/schema";

type BirthdayContact = Pick<Contact, "id" | "name" | "birthMonth" | "birthDay">;
type UpcomingBirthday = Pick<BirthdayContact, "id" | "name"> & { date: Date };

const BIRTHDAY_WINDOW_DAYS = 7;
const novosibirskCalendar = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Novosibirsk",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function findUpcomingBirthdays(
  contacts: readonly BirthdayContact[],
  now: Date,
): UpcomingBirthday[] {
  const parts = novosibirskCalendar.formatToParts(now);
  const year = Number(parts.find(({ type }) => type === "year")?.value);
  const month = Number(parts.find(({ type }) => type === "month")?.value);
  const day = Number(parts.find(({ type }) => type === "day")?.value);

  // Use UTC to represent calendar dates and step through them without time-zone shifts.
  const dates = new Map<string, Date>();
  for (let offset = 0; offset <= BIRTHDAY_WINDOW_DAYS; offset++) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day + offset);
    dates.set(`${date.getUTCMonth() + 1}-${date.getUTCDate()}`, date);
  }

  const birthdays: UpcomingBirthday[] = [];
  for (const { id, name, birthMonth, birthDay } of contacts) {
    const date = dates.get(`${birthMonth}-${birthDay}`);
    if (date) birthdays.push({ id, name, date });
  }
  return birthdays.sort((first, second) =>
    first.date.getTime() - second.date.getTime() || first.id - second.id,
  );
}
