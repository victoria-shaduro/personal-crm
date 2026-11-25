import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import { user } from "../src/db/auth-schema";

export async function seedOwner(db: PostgresJsDatabase) {
  const email = z.email().parse(process.env.OWNER_EMAIL?.trim().toLowerCase());
  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!owner) throw new Error("No migrated owner matches OWNER_EMAIL");
  return owner.id;
}
