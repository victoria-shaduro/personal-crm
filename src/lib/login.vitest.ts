import { expect, test, vi } from "vitest";
import { normalizeEmail, sendLoginMail } from "./login-mail";

test("normalizes a valid email and rejects malformed input on the server", () => {
  expect(normalizeEmail("  Owner@Example.org ")).toBe("owner@example.org");
  expect(normalizeEmail("not an address")).toBeNull();
  expect(normalizeEmail(null)).toBeNull();
});

test("delivers the specified message and keeps the token in the URL fragment", async () => {
  const sendMail = vi.fn().mockResolvedValue({});
  await sendLoginMail("test@example.org", "abc", "https://example.org", sendMail);
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    to: "test@example.org",
    subject: "Вход в Личную CRM",
    from: { name: "Личная CRM", address: "noreply@mail.crm.завяжи-узелок.рф" },
    html: expect.stringContaining('href="https://example.org/login/verify#abc">Войти'),
    text: expect.stringContaining("Если вы не запрашивали вход - просто проигнорируйте письмо"),
  }));
});
