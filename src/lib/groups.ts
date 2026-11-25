import "server-only";

import { eq } from "drizzle-orm";
import { ownerId } from "./current-user";
import { db } from "@/db";
import { groups } from "@/db/schema";

const groupNameCollator = new Intl.Collator("ru", { sensitivity: "base" });

export async function listGroups() {
  const items = await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.ownerId, await ownerId()));
  return items.sort((a, b) => groupNameCollator.compare(a.name, b.name) || a.id - b.id);
}

export type GroupOption = Awaited<ReturnType<typeof listGroups>>[number];
