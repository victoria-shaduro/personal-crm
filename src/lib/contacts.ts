import "server-only";

import { and, asc, desc, eq, getTableColumns, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { cache } from "react";

import { ownerId } from "./current-user";
import { db } from "@/db";
import { contacts, groups, notes } from "@/db/schema";
import { findUpcomingBirthdays } from "@/lib/birthdays";
import type { ContactGroupFilter } from "@/lib/contact-list-filters";

// "Ё" and "е" are used interchangeably in Russian names, so search treats them as equal
function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContacts(query: string, group: ContactGroupFilter = null) {
  const pattern = `%${escapeLikePattern(normalizeForSearch(query))}%`;
  const groupCondition = group === "ungrouped"
    ? isNull(contacts.groupId)
    : group === null ? undefined : eq(contacts.groupId, group);

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(and(
      query ? sql`translate(${contacts.name}, 'Ёё', 'Ее') ilike ${pattern}` : undefined,
      eq(contacts.ownerId, await ownerId()),
      groupCondition,
    ))
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

export async function listUpcomingBirthdays(now = new Date()) {
  const candidates = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      birthMonth: contacts.birthMonth,
      birthDay: contacts.birthDay,
    })
    .from(contacts)
    .where(and(eq(contacts.ownerId, await ownerId()), isNotNull(contacts.birthDay)));
  return findUpcomingBirthdays(candidates, now);
}

export async function listKeepInTouchContacts(now = new Date()) {
  const owned = eq(contacts.ownerId, await ownerId());
  const fields = { id: contacts.id, name: contacts.name, nextContactAt: contacts.nextContactAt };
  // Both parts share a snapshot as well as a clock, even during concurrent writes.
  const [overdue, upcoming] = await db.transaction(async (tx) => Promise.all([
    tx.select(fields).from(contacts).where(and(owned, lt(contacts.nextContactAt, now)))
      .orderBy(asc(contacts.nextContactAt), asc(contacts.id)),
    tx.select(fields).from(contacts).where(and(owned, gte(contacts.nextContactAt, now)))
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
    .select({ ...getTableColumns(contacts), groupName: groups.name })
    .from(contacts)
    .leftJoin(groups, eq(contacts.groupId, groups.id))
    .where(and(eq(contacts.id, id), eq(contacts.ownerId, await ownerId())))
    .limit(1);
  return contact ?? null;
});

export async function getContactNotes(contactId: number) {
  return db
    .select(getTableColumns(notes))
    .from(notes)
    .innerJoin(contacts, eq(notes.contactId, contacts.id))
    .where(and(eq(notes.contactId, contactId), eq(contacts.ownerId, await ownerId())))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Route params arrive as strings; anything but a positive integer is "not found"
export function parseContactId(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}
