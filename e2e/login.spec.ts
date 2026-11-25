import { expect, test } from "@playwright/test";
import { login, requestLink, testEmail } from "./login-helper";

for (const path of ["/", "/groups", "/contacts/new", "/contacts/1", "/contacts/1/edit"]) {
  test(`guests must sign in at ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Почта")).toBeVisible();
  });
}

test("invalid email shows a field error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Почта").fill("invalid");
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByText("Проверь адрес почты")).toBeVisible();
});

test("old and consumed links show the expired screen and sign-out only ends one session", async ({ page, browser }) => {
  const email = testEmail();
  const old = await requestLink(page, email);
  const fresh = await requestLink(page, email);
  await page.goto(old);
  await expect(page.getByRole("link", { name: "На страницу входа" })).toBeVisible();
  await page.goto(fresh);
  await expect(page.getByText("Добавь первый контакт")).toBeVisible();
  await page.goto(fresh);
  await expect(page.getByRole("heading", { name: "Ссылка устарела, запроси новую" })).toBeVisible();
  const second = await browser.newPage();
  try {
    await login(second, email);
    await page.goto("/");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await second.reload();
    await expect(second.getByRole("banner").getByText(email)).toBeVisible();
  } finally { await second.close(); }
});
