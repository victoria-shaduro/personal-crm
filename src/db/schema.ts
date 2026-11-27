import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
export * from "./auth-schema";

export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id").references(() => user.id).notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
  },
  (table) => [unique("groups_owner_name_unique").on(table.ownerId, table.nameKey), unique("groups_owner_id_unique").on(table.ownerId, table.id)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id").references(() => user.id).notNull(),
    name: text("name").notNull(),
    // Who this person is, in the user's own words
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    groupId: integer("group_id"),
    birthMonth: smallint("birth_month"),
    birthDay: smallint("birth_day"),
    birthYear: smallint("birth_year"),
    keepInTouchIntervalDays: integer("keep_in_touch_interval_days"),
    nextContactAt: timestamp("next_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({ name: "contacts_owner_group_fk", columns: [table.ownerId, table.groupId], foreignColumns: [groups.ownerId, groups.id] }),
    index("contacts_name_idx").on(table.name),
    index("contacts_group_id_idx").on(table.groupId),
    index("contacts_next_contact_at_id_idx").on(table.nextContactAt, table.id),
    check("contacts_birth_date_check", sql`
      (${table.birthMonth} IS NULL AND ${table.birthDay} IS NULL AND ${table.birthYear} IS NULL)
      OR (${table.birthMonth} IS NOT NULL AND ${table.birthMonth} BETWEEN 1 AND 12
        AND ${table.birthDay} IS NOT NULL AND ${table.birthDay} BETWEEN 1 AND 31
        AND (${table.birthYear} IS NULL OR ${table.birthYear} BETWEEN 1 AND 9999))
    `),
    check("contacts_keep_in_touch_check", sql`
      (${table.keepInTouchIntervalDays} IS NULL AND ${table.nextContactAt} IS NULL)
      OR (${table.keepInTouchIntervalDays} IS NOT NULL
        AND ${table.keepInTouchIntervalDays} IN (7, 30, 90, 365)
        AND ${table.nextContactAt} IS NOT NULL)
    `),
  ],
);

// Notes are append-only entries written after a conversation
export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notes_contact_id_created_at_idx").on(
      table.contactId,
      table.createdAt,
    ),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
