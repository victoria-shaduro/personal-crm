import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const testEmail = () => `crm-${randomUUID()}@example.org`;

export async function requestLink(page: Page, email: string) {
  const mailbox = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
  const address = email.trim().toLowerCase();
  const search = new URL("/api/v1/search", mailbox);
  search.searchParams.set("query", `to:${address}`);
  async function latestId() {
    const data = await (await page.request.get(search.href)).json();
    return data.messages[0]?.ID as string | undefined;
  }
  const before = await latestId();
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Ссылка для входа отправлена на ${address}` })).toBeVisible();
  await expect.poll(latestId).not.toBe(before);
  const message = await (await page.request.get(`${mailbox}/api/v1/message/${await latestId()}`)).json();
  const link = message.Text.match(/https?:\/\/[^\s]+/)?.[0];
  if (!link) throw new Error("Login link is missing");
  return link as string;
}

export async function login(page: Page, email = testEmail()) {
  const link = await requestLink(page, email);
  await page.goto(link);
  await expect(page.getByRole("banner").getByText(email, { exact: true })).toBeVisible();
  return email;
}
