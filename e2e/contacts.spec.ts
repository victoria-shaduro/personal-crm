import { login } from "./login-helper";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("creates a grouped contact, finds it and saves a note across browser sessions", async ({
  page,
  browser,
}) => {
  const email = await login(page);
  const suffix = randomUUID().slice(0, 8);
  const group = `Test group ${suffix}`;
  const name = `Test contact ${suffix}`;
  const note = `Test note ${suffix}`;
  const list = page.getByRole("region", { name: "Список контактов" });
  const contact = list.getByRole("link", { name: new RegExp(name) });

  await page.goto("/");
  await expect(list.getByText(/^Всего \d+ контакт/)).toBeVisible();

  await page.getByRole("link", { name: "Группы", exact: true }).click();
  await page.getByRole("textbox", { name: "Название группы" }).fill(group);
  await page.getByRole("button", { name: "Добавить группу" }).click();
  await expect(page.getByRole("list", { name: "Список групп" }).getByText(group)).toBeVisible();

  await page.getByRole("link", { name: "Все контакты" }).click();
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Группа", exact: true }).selectOption({ label: group });
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(contact).toBeVisible();

  const groupFilter = page.getByRole("combobox", { name: "Фильтр по группе" });
  await groupFilter.selectOption({ label: "Без группы" });
  await expect(page).toHaveURL(/group=ungrouped/);
  await expect(contact).toHaveCount(0);
  await groupFilter.selectOption({ label: group });
  await expect(contact).toBeVisible();

  const search = page.getByRole("textbox", { name: "Найти контакт по имени" });
  await search.fill(`missing-${suffix}`);
  await expect(list.getByText("Найдено: 0")).toBeVisible();
  await search.fill(name);
  await expect(list.getByText("Найдено: 1")).toBeVisible();
  await contact.click();

  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator("dl").getByText(group, { exact: true })).toBeVisible();
  await page.getByPlaceholder("О чём поговорили, о чём договорились…").fill(note);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(note, { exact: true })).toBeVisible();

  const otherPage = await browser.newPage();
  try {
    await login(otherPage, email);
    await otherPage.goto("/");
    const otherList = otherPage.getByRole("region", { name: "Список контактов" });
    await otherList.getByRole("link", { name, exact: true }).click();
    await expect(otherPage.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(otherPage.getByText(note, { exact: true })).toBeVisible();
  } finally {
    await otherPage.close();
  }
});
