import { expect, test, type Page } from "@playwright/test";
import { login } from "./login-helper";

type BirthdayFields = { day: string; month: string; year?: string };

function birthdayInputs(page: Page) {
  const group = page.getByRole("group", { name: "Дата рождения" });
  return {
    group,
    day: group.getByRole("textbox", { name: "День" }),
    month: group.getByRole("combobox", { name: "Месяц" }),
    year: group.getByRole("textbox", { name: "Год" }),
  };
}

async function fillBirthday(page: Page, { day, month, year = "" }: BirthdayFields) {
  const fields = birthdayInputs(page);
  await expect(fields.group).toBeVisible();
  await fields.day.fill(day);
  await fields.month.selectOption(month);
  await fields.year.fill(year);
}

function contactsRegion(page: Page) {
  return page.getByRole("region", { name: "Список контактов" });
}

async function createContact(page: Page, name: string, birthday?: BirthdayFields) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  if (birthday) await fillBirthday(page, birthday);
  await page.getByRole("button", { name: "Добавить контакт", exact: true }).click();
  await expect(contactsRegion(page).getByRole("link", { name })).toBeVisible();
}

async function openContact(page: Page, name: string) {
  await contactsRegion(page).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function editContact(page: Page) {
  await page.getByRole("link", { name: "Изменить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Изменить контакт" })).toBeVisible();
}

async function saveEdit(page: Page) {
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+(?:\?|$)/);
}

function birthdayDetail(page: Page) {
  return page.locator("dl").getByText("Дата рождения", { exact: true });
}

test("a birthday is optional when creating a contact", async ({ page }) => {
  await login(page);
  await page.goto("/contacts/new");
  await expect(birthdayInputs(page).group).toBeVisible();
  await createContact(page, "No birthday");
  await openContact(page, "No birthday");
  await expect(birthdayDetail(page)).toHaveCount(0);
});

test("a full birthday is shown on the card and prefilled on edit", async ({ page }) => {
  await login(page);
  await createContact(page, "Full birthday", { day: "12", month: "5", year: "1990" });
  await openContact(page, "Full birthday");
  await expect(birthdayDetail(page)).toBeVisible();
  await expect(page.locator("dl").getByText(/^12 мая 1990/)).toBeVisible();
  await editContact(page);
  const fields = birthdayInputs(page);
  await expect(fields.day).toHaveValue("12");
  await expect(fields.month).toHaveValue("5");
  await expect(fields.year).toHaveValue("1990");
});

test("February 29 can be saved with an unknown year", async ({ page }) => {
  await login(page);
  await createContact(page, "Unknown birth year", { day: "29", month: "2" });
  await openContact(page, "Unknown birth year");
  await expect(page.locator("dl").getByText("29 февраля", { exact: true })).toBeVisible();
  await editContact(page);
  await expect(birthdayInputs(page).year).toHaveValue("");
});

test("a saved birthday can be changed and then cleared", async ({ page }) => {
  await login(page);
  await createContact(page, "Change birthday", { day: "12", month: "5", year: "1990" });
  await openContact(page, "Change birthday");
  await editContact(page);
  await fillBirthday(page, { day: "15", month: "6" });
  await saveEdit(page);
  await expect(page.locator("dl").getByText("15 июня", { exact: true })).toBeVisible();
  await editContact(page);
  const fields = birthdayInputs(page);
  await expect(fields.day).toHaveValue("15");
  await expect(fields.month).toHaveValue("6");
  await expect(fields.year).toHaveValue("");
  await fillBirthday(page, { day: "", month: "" });
  await saveEdit(page);
  await expect(birthdayDetail(page)).toHaveCount(0);
});

test("changing a birthday preserves the note and contact schedule", async ({ page }) => {
  await login(page);
  await createContact(page, "Keep the schedule", { day: "12", month: "5" });
  await openContact(page, "Keep the schedule");

  await page.getByLabel("Новая заметка").fill("A note to preserve");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("A note to preserve", { exact: true })).toBeVisible();
  const frequency = page.getByRole("combobox", { name: "Частота общения" });
  await frequency.click();
  await page.getByRole("option", { name: "Раз в неделю" }).click();
  await page.getByRole("button", { name: "Задать частоту" }).click();
  await expect(page.getByRole("button", { name: "Изменить частоту" })).toBeVisible();
  const deadline = page.locator("dl").getByRole("time");
  await expect(deadline).toBeVisible();
  const due = (await deadline.getAttribute("datetime"))!;

  await editContact(page);
  await fillBirthday(page, { day: "15", month: "6" });
  await saveEdit(page);
  await expect(page.locator("dl").getByText("15 июня", { exact: true })).toBeVisible();
  await expect(page.getByText("A note to preserve", { exact: true })).toBeVisible();
  await expect(frequency).toHaveText("Раз в неделю");
  await expect(deadline).toHaveAttribute("datetime", due);
});

test("an incomplete birthday shows an error and preserves the saved date", async ({ page }) => {
  await login(page);
  await createContact(page, "Incomplete birthday", { day: "12", month: "5" });
  await openContact(page, "Incomplete birthday");
  const cardUrl = page.url();
  await editContact(page);
  await fillBirthday(page, { day: "20", month: "" });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();

  const fields = birthdayInputs(page);
  await expect(fields.group.getByRole("alert")).toHaveText(/день и месяц/);
  await expect(fields.day).toHaveValue("20");
  await expect(fields.month).toHaveValue("");
  const card = await page.context().newPage();
  try {
    await card.goto(cardUrl);
    await expect(card.locator("dl").getByText("12 мая", { exact: true })).toBeVisible();
  } finally {
    await card.close();
  }
});

test("saving an impossible birthday shows a field error", async ({ page }) => {
  await login(page);
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill("Invalid birthday");
  for (const birthday of [{ day: "31", month: "4" }, { day: "29", month: "2", year: "2027" }]) {
    await fillBirthday(page, birthday);
    await page.getByRole("button", { name: "Добавить контакт", exact: true }).click();
    const fields = birthdayInputs(page);
    await expect(fields.group.getByRole("alert")).toHaveText(/корректную дату/);
    await expect(fields.day).toHaveValue(birthday.day);
    await expect(fields.month).toHaveValue(birthday.month);
    await expect(fields.year).toHaveValue(birthday.year ?? "");
  }
  await page.goto("/");
  await expect(contactsRegion(page).getByRole("link", { name: "Invalid birthday" })).toHaveCount(0);
});

const novosibirskDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Novosibirsk",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function dateInDays(offset: number) {
  const parts = Object.fromEntries(novosibirskDate.formatToParts().map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offset));
}

function birthdayInDays(offset: number) {
  const date = dateInDays(offset);
  return { day: String(date.getUTCDate()), month: String(date.getUTCMonth() + 1), date };
}

function birthdaysRegion(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

test.describe("upcoming birthdays", () => {
  test("shows a date and opens the contact card", async ({ page }) => {
    await login(page);
    const birthday = birthdayInDays(2);
    await createContact(page, "Upcoming birthday", birthday);
    const row = birthdaysRegion(page).getByRole("link", { name: /Upcoming birthday/ });
    await expect(row.getByRole("time")).toHaveText(shortDate.format(birthday.date));
    await row.click();
    await expect(page.getByRole("heading", { name: "Upcoming birthday" })).toBeVisible();
  });

  test("shows an empty message if contacts have no dates in the window", async ({ page }) => {
    await login(page);
    await createContact(page, "Unscheduled birthday");
    await createContact(page, "Later birthday", birthdayInDays(12));
    await expect(birthdaysRegion(page)).toHaveText(/В ближайшие дни нет дней рождения/);
    await expect(birthdaysRegion(page).getByRole("listitem")).toHaveCount(0);
  });

  test("ignores the contact search and group filter", async ({ page }) => {
    await login(page);
    await createContact(page, "First upcoming birthday", birthdayInDays(2));
    await createContact(page, "Second upcoming birthday", birthdayInDays(4));

    await page.goto("/groups");
    await page.getByLabel("Название группы").fill("Another group");
    await page.getByRole("button", { name: "Добавить группу" }).click();
    await expect(page.getByRole("list", { name: "Список групп" }).getByText("Another group")).toBeVisible();
    await page.goto("/");
    const rows = birthdaysRegion(page).getByRole("link");
    const names = [/First upcoming birthday/, /Second upcoming birthday/];
    await expect(rows).toHaveText(names);

    await page.getByLabel("Фильтр по группе").selectOption({ label: "Another group" });
    await page.getByLabel("Найти контакт по имени").fill("No match");
    await expect(page).toHaveURL(/[?&]q=No(?:\+|%20)match/);
    await expect(contactsRegion(page).getByText("Найдено: 0")).toBeVisible();
    await expect(rows).toHaveText(names);
  });

  test("only shows birthdays for the signed-in user", async ({ page, browser }) => {
    await login(page);
    const second = await browser.newPage({ baseURL: new URL(page.url()).origin });
    try {
      await login(second);
      await createContact(page, "First account birthday", birthdayInDays(2));
      await createContact(second, "Second account birthday", birthdayInDays(2));
      await page.goto("/");
      await second.goto("/");
      await expect(birthdaysRegion(page).getByRole("link")).toHaveText([/First account birthday/]);
      await expect(birthdaysRegion(second).getByRole("link")).toHaveText([/Second account birthday/]);
    } finally {
      await second.close();
    }
  });

  test("updates the list after creating, changing and clearing a birthday", async ({ page }) => {
    await login(page);
    const name = "Change upcoming birthday";
    const nearby = birthdayInDays(2);
    await createContact(page, name, nearby);
    const row = birthdaysRegion(page).getByRole("link", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    for (const [birthday, shown] of [
      [birthdayInDays(12), false],
      [nearby, true],
      [{ day: "", month: "" }, false],
    ] as const) {
      await openContact(page, name);
      await editContact(page);
      await fillBirthday(page, birthday);
      await saveEdit(page);
      await page.goto("/");
      await expect(birthdaysRegion(page)).toBeVisible();
      if (shown) {
        await expect(row).toBeVisible();
      } else {
        await expect(birthdaysRegion(page)).toContainText("В ближайшие дни нет дней рождения");
      }
    }
  });

  test("removes a deleted contact from the birthday and contact lists", async ({ page }) => {
    await login(page);
    const name = "Birthday to delete";
    await createContact(page, name, birthdayInDays(2));
    const row = birthdaysRegion(page).getByRole("link", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await row.click();
    await page.getByRole("button", { name: "Удалить контакт" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(birthdaysRegion(page)).toContainText("В ближайшие дни нет дней рождения");
    await expect(contactsRegion(page).getByText("Пока нет ни одного контакта")).toBeVisible();
  });
});
