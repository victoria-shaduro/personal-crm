"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { groups } from "@/db/schema";
import { groupNameSchema, type GroupFormState } from "@/lib/group-form";
import { logDbError } from "@/lib/log-db-error";

export async function createGroup(
  _previousState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const value = formData.get("name");
  const parsed = groupNameSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const name = parsed.data;
  try {
    const [created] = await db.insert(groups)
      .values({ name, nameKey: name.toLocaleLowerCase("ru") })
      .onConflictDoNothing({ target: groups.nameKey })
      .returning({ id: groups.id });
    if (!created) return { error: "Группа с таким названием уже есть." };
  } catch (error) {
    logDbError("Failed to create group", error);
    return { error: "Не получилось создать группу. Попробуйте ещё раз." };
  }

  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}
