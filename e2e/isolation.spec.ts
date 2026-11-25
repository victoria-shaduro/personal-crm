import { expect, test, type Page } from "@playwright/test";
import { login } from "./login-helper";

async function addRecords(page: Page) {
  const email = await login(page);
  const name = `Contact ${email}`;
  const group = `Group ${email}`;
  const note = `Note ${email}`;
  await page.goto("/groups");
  await page.getByLabel("Название группы").fill(group);
  await page.getByRole("button", { name: "Добавить группу" }).click();
  await expect(page.getByText(group, { exact: true })).toBeVisible();
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name);
  const select = page.getByLabel("Группа", { exact: true });
  await select.selectOption({ label: group });
  const groupId = await select.inputValue();
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const link = page.getByRole("region", { name: "Список контактов" }).getByRole("link", { name: new RegExp(name) });
  await expect(link).toBeVisible();
  const path = (await link.getAttribute("href"))!;
  await link.click();
  await expect(page).toHaveURL(new RegExp(path + "$"));
  await page.getByLabel("Новая заметка").fill(note);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  await page.getByLabel("Частота общения").click();
  await page.getByRole("option", { name: "Раз в неделю" }).click();
  await page.getByRole("button", { name: "Задать частоту" }).click();
  await expect(page.getByRole("button", { name: "Изменить частоту" })).toBeVisible();
  return { page, name, group, groupId, path, note };
}

test("each account can only see its own contacts, groups, notes and reminders", async ({ page, browser }) => {
  test.setTimeout(120000);
  const second = await browser.newPage();
  try {
    const a = await addRecords(page);
    const b = await addRecords(second);
    for (const [own, other] of [[a, b], [b, a]]) {
      const p = own.page;
      await p.goto("/");
      for (const region of ["Список контактов", "Пора связаться"]) {
        const list = p.getByRole("region", { name: region });
        await expect(list.getByText(own.name)).toBeVisible();
        await expect(list.getByText(other.name)).toHaveCount(0);
      }
      const filter = p.getByRole("combobox", { name: "Фильтр по группе", disabled: false });
      await expect(filter.getByRole("option", { name: other.group })).toHaveCount(0);
      await filter.selectOption({ label: own.group });
      await expect(p.getByRole("region", { name: "Список контактов" }).getByText(own.name)).toBeVisible();
      await p.getByLabel("Найти контакт по имени").fill(other.name);
      await expect(p.getByText("Найдено: 0")).toBeVisible();
      await p.goto("/?" + new URLSearchParams({ group: other.groupId, q: own.name }));
      await expect(filter).toHaveValue("");
      await expect(p.getByText("Найдено: 1")).toBeVisible();
      await expect(p.getByRole("region", { name: "Список контактов" }).getByText(own.name)).toBeVisible();
      await p.goto("/groups");
      await expect(p.getByText(own.group, { exact: true })).toBeVisible();
      await expect(p.getByText(other.group, { exact: true })).toHaveCount(0);
      for (const path of [other.path, other.path + "/edit"]) {
        await p.goto(path);
        await expect(p.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
        await expect(p.getByText(other.note)).toHaveCount(0);
      }
    }
  } finally {
    await second.close();
  }
});
