import "server-only";

import { db } from "@/db";
import { groups } from "@/db/schema";

const groupNameCollator = new Intl.Collator("ru", { sensitivity: "base" });

export async function listGroups() {
  const items = await db.select({ id: groups.id, name: groups.name }).from(groups);
  return items.sort((a, b) => groupNameCollator.compare(a.name, b.name) || a.id - b.id);
}

export type GroupOption = Awaited<ReturnType<typeof listGroups>>[number];
