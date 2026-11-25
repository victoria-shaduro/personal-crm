import nodemailer, { type SendMailOptions } from "nodemailer";
import { z } from "zod";

export function normalizeEmail(value: unknown) {
  const result = z.email().safeParse(typeof value === "string" ? value.trim().toLowerCase() : "");
  return result.success ? result.data : null;
}

function deliver(message: SendMailOptions) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  if (!host || !port) throw new Error("SMTP configuration required");
  return nodemailer.createTransport({
    host, port, secure: port === 465,
    requireTLS: Boolean(process.env.SMTP_USER) && port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 8000, socketTimeout: 10000, greetingTimeout: 8000,
  }).sendMail(message);
}

export async function sendLoginMail(email: string, token: string, origin: string, send = deliver) {
  const link = new URL("/login/verify", origin);
  link.hash = encodeURIComponent(token);
  const duration = "Ссылка работает 15 минут.";
  const footer = "Если вы не запрашивали вход - просто проигнорируйте письмо";
  await send({
    from: { name: "Личная CRM", address: "noreply@завяжи-узелок.рф" },
    to: email, subject: "Вход в Личную CRM",
    text: `Войти: ${link}\n${duration}\n${footer}`,
    html: `<p><a href="${link}">Войти</a></p><p>${duration}</p><p>${footer}</p>`,
  });
}
