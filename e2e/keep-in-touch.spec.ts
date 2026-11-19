import { randomUUID } from "node:crypto";
import { expect, test as base, type Page } from "@playwright/test";
import postgres from "postgres";

type TestContact = { name: string; deadline?: Date; about?: string };

const test = base.extend<{
  database: postgres.Sql;
  createContact: (contact: TestContact) => Promise<number>;
}>({
  database: async ({}, provide) => {
    const testDatabaseUrl = process.env.GROUPS_TEST_DATABASE_URL;
    if (!testDatabaseUrl || !["127.0.0.1", "localhost"].includes(new URL(testDatabaseUrl).hostname)) {
      throw new Error("Set GROUPS_TEST_DATABASE_URL to the local PostgreSQL test database used by the app");
    }
    const database = postgres(testDatabaseUrl);
    try {
      await provide(database);
    } finally {
      await database.end();
    }
  },
  createContact: async ({ database }, provide) => {
    const ids: number[] = [];
    try {
      await provide(async ({ name, deadline, about }) => {
        const [{ id }] = await database<{ id: number }[]>`insert into contacts
          (name, about, keep_in_touch_interval_days, next_contact_at)
          values (${name}, ${about ?? null}, ${deadline ? 7 : null}, ${deadline ?? null}) returning id`;
        ids.push(id);
        return id;
      });
    } finally {
      if (ids.length > 0) await database`delete from contacts where id in ${database(ids)}`;
    }
  },
});

test.use({ timezoneId: "America/Los_Angeles" });

const dayMs = 86_400_000;
const novosibirskDate = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Novosibirsk", day: "numeric", month: "long", year: "numeric",
});

function reminders(page: Page) {
  return page.getByRole("region", { name: "Пора связаться" });
}

function cardDeadline(page: Page) {
  return page.locator("dl").getByRole("time");
}

async function chooseFrequency(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Частота общения" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function rejectScheduleChanges(database: postgres.Sql, id: number, savedDeadline: Date, checkError: () => Promise<void>) {
  // Let PostgreSQL escape the values for the constraint, which cannot take bind parameters.
  const [{ predicate }] = await database<{ predicate: string }[]>`select format(
    'id <> %L OR next_contact_at IS NOT DISTINCT FROM %L::timestamptz',
    ${id}::integer, ${savedDeadline.toISOString()}::text
  ) as predicate`;
  const constraint = database(`test_preserve_schedule_${id}`);
  await database`alter table contacts add constraint ${constraint} check (${database.unsafe(predicate)})`;
  try {
    await checkError();
  } finally {
    await database`alter table contacts drop constraint ${constraint}`;
  }
}

test("sets, changes and removes a contact frequency, preserving the note and draft", async ({ page, browser, database, createContact }) => {
  const name = `Frequency ${randomUUID()}`;
  const id = await createContact({ name });
  const cardPath = `/contacts/${id}`;
  const note = page.getByRole("textbox", { name: "Новая заметка" });
  const frequency = page.getByRole("combobox", { name: "Частота общения" });
  const setFrequency = page.getByRole("button", { name: "Задать частоту" });
  const changeFrequency = page.getByRole("button", { name: "Изменить частоту" });

  await page.goto(cardPath);
  await expect(frequency).toHaveText("Не задано");
  await expect(page.getByRole("button", { name: /Отметить общение/ })).toHaveCount(0);
  await note.fill("Conversation before setting a frequency");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Conversation before setting a frequency", { exact: true })).toBeVisible();
  await expect(cardDeadline(page)).toHaveCount(0);

  await note.fill("Unfinished note");
  await frequency.click();
  await expect(page.getByRole("option")).toHaveText([
    "Не задано", "Раз в неделю", "Раз в месяц", "Раз в квартал", "Раз в год",
  ]);
  await page.getByRole("option", { name: "Раз в неделю", exact: true }).click();
  await expect(setFrequency).toBeEnabled();
  await expect(cardDeadline(page)).toHaveCount(0);
  await setFrequency.click();
  await expect(changeFrequency).toBeEnabled();
  await expect(note).toHaveValue("Unfinished note");
  await expect(cardDeadline(page)).toBeVisible();
  const firstDeadline = (await cardDeadline(page).getAttribute("datetime"))!;
  const firstDate = novosibirskDate.format(new Date(firstDeadline));
  await expect(cardDeadline(page)).toHaveText(firstDate);

  await page.reload();
  await expect(frequency).toHaveText("Раз в неделю");
  await expect(cardDeadline(page)).toHaveAttribute("datetime", firstDeadline);
  const otherPage = await browser.newPage({ timezoneId: "Pacific/Kiritimati" });
  try {
    await otherPage.goto(new URL(cardPath, page.url()).href);
    await expect(otherPage.getByRole("combobox", { name: "Частота общения" })).toHaveText("Раз в неделю");
    await expect(cardDeadline(otherPage)).toHaveText(firstDate);
  } finally {
    await otherPage.close();
  }

  await page.getByRole("link", { name: "Все контакты" }).click();
  const reminder = reminders(page).getByRole("link", { name: new RegExp(name) });
  await expect(reminder.locator("time")).toHaveText(firstDate);
  await reminder.locator("time").click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  await chooseFrequency(page, "Раз в месяц");
  await expect(changeFrequency).toBeEnabled();
  await expect(cardDeadline(page)).toHaveAttribute("datetime", firstDeadline);

  await rejectScheduleChanges(database, id, new Date(firstDeadline), async () => {
    await changeFrequency.click();
    await expect(page.getByRole("alert").filter({ hasText: "Не получилось сохранить" })).toBeVisible();
    await expect(cardDeadline(page)).toHaveAttribute("datetime", firstDeadline);
    await expect(frequency).toHaveText("Раз в месяц");
    await expect(changeFrequency).toBeEnabled();
  });

  await changeFrequency.click();
  await expect(cardDeadline(page)).not.toHaveAttribute("datetime", firstDeadline);
  await expect(frequency).toHaveText("Раз в месяц");

  await chooseFrequency(page, "Не задано");
  await expect(changeFrequency).toBeEnabled();
  await changeFrequency.click();
  await expect(setFrequency).toBeEnabled();
  await expect(cardDeadline(page)).toHaveCount(0);
  await expect(page.getByText("Conversation before setting a frequency", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(reminders(page).getByText("Пока нет запланированных контактов")).toBeVisible();
});

test("a manual note moves an overdue contact to a new date", async ({ page, createContact }) => {
  const name = `Manual note ${randomUUID()}`;
  const oldDeadline = new Date(Date.now() - dayMs);
  await createContact({ name, deadline: oldDeadline });
  await page.goto("/");
  const reminder = reminders(page).getByRole("link", { name: new RegExp(name) });
  await expect(reminder).toContainText("Пора связаться");
  await reminder.click();
  await expect(cardDeadline(page)).toHaveAttribute("datetime", oldDeadline.toISOString());

  const addNote = page.getByRole("button", { name: "Добавить заметку" });
  await addNote.click();
  await expect(page.getByText(/Заметка пустая/)).toBeVisible();
  await expect(cardDeadline(page)).toHaveAttribute("datetime", oldDeadline.toISOString());

  await page.getByRole("textbox", { name: "Новая заметка" }).fill("A new conversation");
  await addNote.click();
  const savedNote = page.getByRole("listitem").filter({ hasText: "A new conversation" });
  await expect(savedNote).toBeVisible();
  const notedAt = Date.parse((await savedNote.locator("time").getAttribute("datetime"))!);
  const expectedDeadline = new Date(notedAt + 7 * dayMs);
  await expect(cardDeadline(page)).toHaveAttribute("datetime", expectedDeadline.toISOString());

  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(reminder).toContainText("Запланировано");
  await expect(reminder.locator("time")).toHaveText(novosibirskDate.format(expectedDeadline));
});

test("quick marks on the home page save one note and refill the upcoming list", async ({ page, database, createContact }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const suffix = randomUUID().slice(0, 8);
  const overdueName = `Overdue ${suffix}`;
  const firstName = `First upcoming contact with a very long name that wraps on a phone ${suffix}`;
  const secondName = `Second upcoming ${suffix}`;
  const thirdName = `Third upcoming ${suffix}`;
  const baseDay = new Date();
  baseDay.setUTCHours(20, 15, 0, 0);
  const deadline = (days: number) => new Date(baseDay.getTime() + days * dayMs);
  const overdueId = await createContact({ name: overdueName, deadline: deadline(-2) });
  const firstId = await createContact({ name: firstName, deadline: deadline(1), about: "Private description" });
  await createContact({ name: secondName, deadline: deadline(2) });
  await createContact({ name: thirdName, deadline: deadline(3) });

  await page.goto("/");
  const block = reminders(page);
  const overdue = block.getByRole("link", { name: new RegExp(overdueName) });
  const first = block.getByRole("link", { name: new RegExp(firstName) });
  const second = block.getByRole("link", { name: new RegExp(secondName) });
  const third = block.getByRole("link", { name: new RegExp(thirdName) });
  await expect(overdue).toBeVisible();
  await expect(first.getByText(firstName, { exact: true })).toBeVisible();
  await expect(first.locator("time")).toHaveText(novosibirskDate.format(deadline(1)));
  await expect(first).not.toContainText("Private description");
  await expect(second).toBeVisible();
  await expect(third).toHaveCount(0);
  expect(await overdue.evaluate((link) => getComputedStyle(link).color))
    .not.toBe(await first.evaluate((link) => getComputedStyle(link).color));

  await first.getByText(firstName, { exact: true }).click();
  await expect(page.getByRole("heading", { name: firstName, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(first).toBeVisible();

  const quickMark = block.getByRole("button", { name: `Отметить общение с ${firstName}`, exact: true });
  await rejectScheduleChanges(database, firstId, deadline(1), async () => {
    await quickMark.click();
    await expect(block.getByRole("alert")).toContainText("Не получилось сохранить");
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    await expect(first.locator("time")).toHaveAttribute("datetime", deadline(1).toISOString());
    await expect(quickMark).toBeEnabled();
  });

  await database.begin(async (transaction) => {
    await transaction`select id from contacts where id = ${firstId} for update`;
    await quickMark.press("Enter");
    await expect(quickMark).toBeDisabled();
    await expect(quickMark).toHaveAttribute("aria-busy", "true");
  });

  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await expect(first).toHaveCount(0);
  await expect(third).toBeVisible();
  await block.getByRole("button", { name: `Отметить общение с ${overdueName}`, exact: true }).click();
  await expect(overdue).toHaveCount(0);
  await expect(second).toBeVisible();
  await expect(third).toBeVisible();

  const contactList = page.getByRole("region", { name: "Список контактов" });
  for (const [id, name] of [[firstId, firstName], [overdueId, overdueName]] as const) {
    await contactList.getByRole("link").filter({ hasText: name }).click();
    await expect(page).toHaveURL(new URL(`/contacts/${id}`, page.url()).href);
    const autoNote = page.getByRole("listitem").filter({ hasText: "Связались" });
    await expect(autoNote).toHaveCount(1);
    const markedAt = Date.parse((await autoNote.locator("time").getAttribute("datetime"))!);
    await expect(cardDeadline(page)).toHaveAttribute("datetime", new Date(markedAt + 7 * dayMs).toISOString());
    await page.getByRole("link", { name: "Все контакты" }).click();
    await expect(third).toBeVisible();
  }
});
