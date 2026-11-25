import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { mailDelivery } from "@/db/auth-schema";
import { createAuth, fingerprint } from "./auth";
import { normalizeEmail } from "./login-mail";

export async function requestLogin(input: unknown, headers: Headers) {
  const email = normalizeEmail(input);
  if (!email) return "Проверь адрес почты";
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`);
      const recent = await tx.select({ sentAt: mailDelivery.sentAt }).from(mailDelivery)
        .where(and(eq(mailDelivery.email, email), gt(mailDelivery.sentAt, sql`clock_timestamp() - interval '10 minutes'`))).limit(3);
      if (recent.length >= 3) return "Слишком часто, попробуй через несколько минут";
      await tx.update(mailDelivery).set({ active: false }).where(and(eq(mailDelivery.email, email), eq(mailDelivery.active, true)));
      await createAuth(tx).api.signInMagicLink({ body: { email }, headers });
      return `Ссылка для входа отправлена на ${email}`;
    });
  } catch {
    return "Не получилось отправить ссылку. Попробуй ещё раз";
  }
}

export async function consumeLogin(token: string, headers: Headers) {
  const key = fingerprint(token);
  return db.transaction(async (tx) => {
    const [delivery] = await tx.select({ email: mailDelivery.email }).from(mailDelivery)
      .where(eq(mailDelivery.fingerprint, key));
    if (!delivery) return null;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${delivery.email}, 0))`);
    const active = await tx.update(mailDelivery).set({ active: false })
      .where(and(eq(mailDelivery.fingerprint, key), eq(mailDelivery.active, true))).returning();
    if (!active.length) return null;
    const result = await createAuth(tx).api.magicLinkVerify({ query: { token }, headers, asResponse: true });
    return result.ok ? result.headers.getSetCookie() : null;
  });
}
