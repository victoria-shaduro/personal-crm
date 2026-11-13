"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactSchema,
  noteSchema,
  readContactForm,
  type ContactFormState,
  type DeleteContactState,
  type NoteFormState,
  type KeepInTouchFormState,
  type MarkContactedState,
} from "@/lib/contact-form";
import { logDbError } from "@/lib/log-db-error";
import { isKeepInTouchInterval, nextContactDate } from "@/lib/keep-in-touch";

const SAVE_FAILED_MESSAGE =
  "Не получилось сохранить. Проверьте, что запущен Docker Desktop с базой данных, и попробуйте ещё раз.";

const contactIdSchema = z.number().int().positive();

export async function createContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  let createdId: number;
  try {
    const [created] = await db
      .insert(contacts)
      .values(parsed.data)
      .returning({ id: contacts.id });
    createdId = created.id;
  } catch (error) {
    logDbError("Failed to create contact", error);
    return { message: SAVE_FAILED_MESSAGE };
  }

  revalidatePath("/", "layout");
  redirect(`/?added=${createdId}`);
}

export async function updateContact(
  contactId: number,
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  if (!contactIdSchema.safeParse(contactId).success) {
    return { message: "Контакт не найден." };
  }

  const parsed = contactSchema.safeParse(readContactForm(formData));
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const [updated] = await db
      .update(contacts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (!updated) {
      return { message: "Контакт не найден." };
    }
  } catch (error) {
    logDbError("Failed to update contact", error, { contactId });
    return { message: SAVE_FAILED_MESSAGE };
  }

  revalidatePath("/", "layout");
  redirect(`/contacts/${contactId}?saved=1`);
}

export async function addNote(
  contactId: number,
  _previousState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const rawBody = formData.get("body");
  const body = typeof rawBody === "string" ? rawBody : "";
  if (!contactIdSchema.safeParse(contactId).success) {
    return { body, error: "Контакт не найден." };
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { body, error: parsed.error.issues[0]?.message };
  }

  try {
    const added = await recordCommunicationNote(contactId, parsed.data);
    if (!added) {
      return { body, error: "Контакт не найден." };
    }
  } catch (error) {
    logDbError("Failed to add note", error, { contactId });
    return { body, error: SAVE_FAILED_MESSAGE };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { savedAt: Date.now() };
}

async function recordCommunicationNote(contactId: number, body: string) {
  return db.transaction(async (tx) => {
    const [contact] = await tx.select().from(contacts)
      .where(eq(contacts.id, contactId)).for("update");
    if (!contact) return false;
    const now = new Date();
    await tx.insert(notes).values({ contactId, body, createdAt: now });
    await tx.update(contacts).set({
      updatedAt: now,
      nextContactAt: contact.keepInTouchIntervalDays === null
        ? null : nextContactDate(now, contact.keepInTouchIntervalDays),
    }).where(eq(contacts.id, contactId));
    return true;
  });
}

export async function updateKeepInTouch(
  contactId: number,
  _previousState: KeepInTouchFormState,
  formData: FormData,
): Promise<KeepInTouchFormState> {
  if (!contactIdSchema.safeParse(contactId).success) return { error: "Контакт не найден." };
  const value = formData.get("intervalDays");
  if (typeof value !== "string" || !["", "7", "30", "90", "365"].includes(value)) {
    return { error: "Выберите частоту из списка." };
  }
  const interval = value === "" ? null : Number(value);
  if (interval !== null && !isKeepInTouchInterval(interval)) return { error: "Выберите частоту из списка." };
  try {
    const updated = await db.transaction(async (tx) => {
      const [contact] = await tx.select({ id: contacts.id }).from(contacts)
        .where(eq(contacts.id, contactId)).for("update");
      if (!contact) return false;
      const now = new Date();
      await tx.update(contacts).set({
        keepInTouchIntervalDays: interval,
        nextContactAt: interval === null ? null : nextContactDate(now, interval),
        updatedAt: now,
      }).where(eq(contacts.id, contactId));
      return true;
    });
    if (!updated) return { error: "Контакт не найден." };
  } catch (error) {
    logDbError("Failed to update keep-in-touch schedule", error, { contactId });
    return { error: SAVE_FAILED_MESSAGE };
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { savedAt: Date.now() };
}

export async function markContacted(
  contactId: number,
  _previousState: MarkContactedState,
  _formData: FormData,
): Promise<MarkContactedState> {
  void _formData;
  if (!contactIdSchema.safeParse(contactId).success) return { error: "Контакт не найден." };
  try {
    if (!await recordCommunicationNote(contactId, "Связались")) return { error: "Контакт не найден." };
  } catch (error) {
    logDbError("Failed to mark contact as contacted", error, { contactId });
    return { error: SAVE_FAILED_MESSAGE };
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { savedAt: Date.now() };
}

export async function deleteContact(
  contactId: number,
  _previousState: DeleteContactState,
  _formData: FormData,
): Promise<DeleteContactState> {
  void _previousState;
  void _formData;
  if (!contactIdSchema.safeParse(contactId).success) {
    return { message: "Контакт не найден." };
  }
  try {
    const [deleted] = await db.delete(contacts)
      .where(eq(contacts.id, contactId)).returning({ id: contacts.id });
    if (!deleted) return { message: "Контакт не найден." };
  } catch (error) {
    logDbError("Failed to delete contact", error, { contactId });
    return { message: "Не получилось удалить контакт. Попробуйте ещё раз." };
  }
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
