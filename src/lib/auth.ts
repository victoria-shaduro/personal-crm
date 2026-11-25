import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "@/db";
import * as schema from "@/db/auth-schema";
import { sendLoginMail } from "./login-mail";

export const fingerprint = (token: string) => createHash("sha256").update(token).digest("base64url");
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function createAuth(database: typeof db | Transaction = db) {
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL || !process.env.BETTER_AUTH_SECRET) throw new Error("Authentication configuration required");
  return betterAuth({
    baseURL, secret: process.env.BETTER_AUTH_SECRET,
    advanced: { useSecureCookies: new URL(baseURL).protocol === "https:" },
    database: drizzleAdapter(database, { provider: "pg", schema }),
    session: { expiresIn: 30 * 86400, updateAge: 0 },
    logger: { disabled: true },
    plugins: [magicLink({
      expiresIn: 900, storeToken: "hashed",
      async sendMagicLink({ email, token }) {
        await sendLoginMail(email, token, baseURL);
        await database.insert(schema.mailDelivery).values({ email, fingerprint: fingerprint(token), sentAt: sql`clock_timestamp()` });
      },
    })],
  });
}
