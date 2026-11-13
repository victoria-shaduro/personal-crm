import "server-only";

import { asc, desc, eq, gte, lt, sql } from "drizzle-orm";
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

export async function listKeepInTouchContacts(now = new Date()) {
  const fields = { id: contacts.id, name: contacts.name, nextContactAt: contacts.nextContactAt };
  // Both parts share a snapshot as well as a clock, even during concurrent writes.
  const [overdue, upcoming] = await db.transaction(async (tx) => Promise.all([
    tx.select(fields).from(contacts).where(lt(contacts.nextContactAt, now))
      .orderBy(asc(contacts.nextContactAt), asc(contacts.id)),
    tx.select(fields).from(contacts).where(gte(contacts.nextContactAt, now))
      .orderBy(asc(contacts.nextContactAt), asc(contacts.id)).limit(2),
  ]), { isolationLevel: "repeatable read", accessMode: "read only" });
  return [
    ...overdue.map((contact) => ({ ...contact, overdue: true })),
    ...upcoming.map((contact) => ({ ...contact, overdue: false })),
  ];
}

export type KeepInTouchListItem = Awaited<ReturnType<typeof listKeepInTouchContacts>>[number];

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
