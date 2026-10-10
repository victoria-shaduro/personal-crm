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
  type NoteFormState,
} from "@/lib/contact-form";

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
    console.error("Failed to create contact", error);
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
    console.error("Failed to update contact", { contactId, error });
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
    const added = await db.transaction(async (tx) => {
      const [touched] = await tx
        .update(contacts)
        .set({ updatedAt: new Date() })
        .where(eq(contacts.id, contactId))
        .returning({ id: contacts.id });
      if (!touched) return false;
      await tx.insert(notes).values({ contactId, body: parsed.data });
      return true;
    });
    if (!added) {
      return { body, error: "Контакт не найден." };
    }
  } catch (error) {
    console.error("Failed to add note", { contactId, error });
    return { body, error: SAVE_FAILED_MESSAGE };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { savedAt: Date.now() };
}
