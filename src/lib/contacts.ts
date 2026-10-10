import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

// "Ё" and "е" are used interchangeably in Russian names, so search treats them as equal
function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContacts(query: string) {
  const pattern = `%${escapeLikePattern(normalizeForSearch(query))}%`;

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(
      query
        ? sql`translate(${contacts.name}, 'Ёё', 'Ее') ilike ${pattern}`
        : undefined,
    )
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

// Cached per request so metadata and the page share one query
export const getContact = cache(async (id: number) => {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  return contact ?? null;
});

export async function getContactNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Route params arrive as strings; anything but a positive integer is "not found"
export function parseContactId(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}
