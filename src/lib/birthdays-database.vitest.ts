import { randomUUID } from "node:crypto";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createContact, updateContact } from "@/app/contacts/actions";
import * as schema from "@/db/schema";

const testDatabaseUrl = process.env.GROUPS_TEST_DATABASE_URL;
const databaseName = `birthdays_test_${randomUUID().replaceAll("-", "")}`;
const legacyDeadline = new Date("2026-11-21T11:00:00Z");
let admin: postgres.Sql | undefined;
let client: postgres.Sql;
let database: ReturnType<typeof drizzle<typeof schema>>;
let ownerId: string;
let legacyId: number;
let groupId: number;

vi.mock("@/lib/current-user", () => ({ ownerId: async () => ownerId }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ get db() { return database; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));

function contactForm(name: string, day?: string, month?: string, year?: string) {
  const form = new FormData();
  form.set("name", name);
  if (day !== undefined) form.set("birthDay", day);
  if (month !== undefined) form.set("birthMonth", month);
  if (year !== undefined) form.set("birthYear", year);
  return form;
}

async function applyMigrations(migrations: ReturnType<typeof readMigrationFiles>) {
  await client.begin(async (transaction) => {
    for (const migration of migrations) {
      for (const statement of migration.sql) {
        if (statement.trim()) await transaction.unsafe(statement);
      }
    }
  });
}

describe.runIf(Boolean(testDatabaseUrl))("birthdays with PostgreSQL", () => {
  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("A PostgreSQL test URL is required");
    const url = new URL(testDatabaseUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Birthday integration tests require a local PostgreSQL server");
    }
    admin = postgres(url.toString());
    await admin`create database ${admin(databaseName)}`;
    url.pathname = `/${databaseName}`;
    client = postgres(url.toString(), {
      connection: { "crm.owner_email": "owner@example.org" },
    });
    database = drizzle(client, { schema });

    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    await applyMigrations(migrations.slice(0, 4));
    const [owner] = await client<{ id: string }[]>`select id from auth_user`;
    ownerId = owner.id;
    const [group] = await client<{ id: number }[]>`
      insert into groups (owner_id, name, name_key)
      values (${ownerId}, 'Test group', 'test group') returning id
    `;
    groupId = group.id;
    const [legacy] = await client<{ id: number }[]>`
      insert into contacts (owner_id, name, group_id, keep_in_touch_interval_days, next_contact_at)
      values (${ownerId}, 'Legacy contact', ${groupId}, 30, ${legacyDeadline.toISOString()}) returning id
    `;
    legacyId = legacy.id;
    await client`insert into notes (contact_id, body) values (${legacyId}, 'Legacy note')`;
    await applyMigrations(migrations.slice(4));
  });

  afterAll(async () => {
    await client?.end();
    if (admin) {
      try {
        await admin`drop database if exists ${admin(databaseName)}`;
      } finally {
        await admin.end();
      }
    }
  });

  test("the migration preserves an existing contact, group, note and reminder", async () => {
    const [contact] = await client`
      select contacts.name, group_id, groups.name as group_name,
        keep_in_touch_interval_days, next_contact_at, birth_month, birth_day, birth_year
      from contacts join groups on contacts.group_id = groups.id where contacts.id = ${legacyId}
    `;
    expect({ ...contact, next_contact_at: new Date(contact.next_contact_at) }).toEqual({
      name: "Legacy contact",
      group_id: groupId,
      group_name: "Test group",
      keep_in_touch_interval_days: 30,
      next_contact_at: legacyDeadline,
      birth_month: null,
      birth_day: null,
      birth_year: null,
    });
    const notes = await client`select body from notes where contact_id = ${legacyId}`;
    expect(notes).toEqual([{ body: "Legacy note" }]);
  });

  test("the previous app can write contacts using the previous columns", async () => {
    const [contact] = await client<{ id: number }[]>`
      insert into contacts (owner_id, name) values (${ownerId}, 'Old app contact') returning id
    `;
    await client`
      update contacts set birth_month = 5, birth_day = 12, birth_year = 1990 where id = ${contact.id}
    `;
    await client`
      update contacts set name = 'Edited by old app', updated_at = now() where id = ${contact.id}
    `;
    const [updated] = await client`
      select name, birth_month, birth_day, birth_year from contacts where id = ${contact.id}
    `;
    expect(updated).toEqual({
      name: "Edited by old app", birth_month: 5, birth_day: 12, birth_year: 1990,
    });
  });

  test.each([
    [5, null, null],
    [null, null, 1990],
    [13, 5, null],
    [1, 32, null],
    [1, 1, 0],
  ])("the database rejects incomplete or out-of-range values (%s, %s, %s)", async (month, day, year) => {
    await expect(client`
      insert into contacts (owner_id, name, birth_month, birth_day, birth_year)
      values (${ownerId}, 'Invalid birthday', ${month}, ${day}, ${year})
    `).rejects.toMatchObject({ code: "23514" });
  });

  test.each([
    { name: "Empty date", day: "", month: "", year: "", saved: [null, null, null] },
    { name: "Full date", day: "12", month: "5", year: "1990", saved: [12, 5, 1990] },
    { name: "Unknown year", day: "29", month: "2", year: "", saved: [29, 2, null] },
    { name: "Leap date", day: "29", month: "2", year: "2000", saved: [29, 2, 2000] },
  ])("the create action stores $name", async ({ name, day, month, year, saved }) => {
    await expect(createContact({}, contactForm(name, day, month, year))).rejects.toThrow(/Redirect: \/\?added=\d+/);
    const [contact] = await client`select birth_day, birth_month, birth_year from contacts where name = ${name}`;
    expect(Object.values(contact)).toEqual(saved);
  });

  test.each([
    ["8", "", ""],
    ["", "5", ""],
    ["", "", "1990"],
    ["31", "4", ""],
    ["29", "2", "2027"],
    ["29", "2", "1900"],
    ["0", "1", ""],
    ["1", "13", ""],
    ["1", "1", "0000"],
    ["1", "1", "10000"],
    ["1e1", "1", ""],
  ])("the server rejects an invalid date (%s, %s, %s)", async (day, month, year) => {
    const form = contactForm("Cannot be saved", day, month, year);
    await expect(createContact({}, form)).resolves.toMatchObject({
      errors: { birthday: [expect.any(String)] },
    });
    await expect(updateContact(legacyId, {}, form)).resolves.toMatchObject({
      errors: { birthday: [expect.any(String)] },
    });
    const [legacy] = await client`select name from contacts where id = ${legacyId}`;
    expect(legacy.name).toBe("Legacy contact");
    const invalid = await client`select id from contacts where name = 'Cannot be saved'`;
    expect(invalid).toHaveLength(0);
  });

  test("the update action edits and explicitly clears the birthday without touching other data", async () => {
    await expect(updateContact(legacyId, {}, contactForm("Legacy contact", "15", "5", "1990")))
      .rejects.toThrow(`Redirect: /contacts/${legacyId}?saved=1`);
    const [updated] = await client`select birth_day, birth_month, birth_year from contacts where id = ${legacyId}`;
    expect(updated).toEqual({ birth_day: 15, birth_month: 5, birth_year: 1990 });

    await expect(updateContact(legacyId, {}, contactForm("Legacy contact")))
      .rejects.toThrow(`Redirect: /contacts/${legacyId}?saved=1`);
    const [previousForm] = await client`select birth_day, birth_month, birth_year from contacts where id = ${legacyId}`;
    expect(previousForm).toEqual(updated);

    await expect(updateContact(legacyId, {}, contactForm("Legacy contact", "", "", "")))
      .rejects.toThrow(`Redirect: /contacts/${legacyId}?saved=1`);
    const [cleared] = await client`
      select birth_day, birth_month, birth_year, group_id, keep_in_touch_interval_days, next_contact_at
      from contacts where id = ${legacyId}
    `;
    expect({ ...cleared, next_contact_at: new Date(cleared.next_contact_at) }).toEqual({
      birth_day: null,
      birth_month: null,
      birth_year: null,
      group_id: groupId,
      keep_in_touch_interval_days: 30,
      next_contact_at: legacyDeadline,
    });
    expect(await client`select body from notes where contact_id = ${legacyId}`).toEqual([{ body: "Legacy note" }]);
  });
});
