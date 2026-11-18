import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createContact, deleteContact, updateContact } from "@/app/contacts/actions";
import { createGroup } from "@/app/groups/actions";
import * as schema from "@/db/schema";
import { getContact, getContactNotes, listContacts, listKeepInTouchContacts } from "@/lib/contacts";
import { listGroups } from "@/lib/groups";

const testDatabaseUrl = process.env.GROUPS_TEST_DATABASE_URL;
const databaseName = `groups_test_${randomUUID().replaceAll("-", "")}`;
const legacyDate = new Date("2026-11-01T10:00:00.000Z");
let admin: ReturnType<typeof postgres> | undefined;
let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>>;
let legacyId: number;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ get db() { return database; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));

async function applyMigrations(
  connection: ReturnType<typeof postgres>,
  migrations: ReturnType<typeof readMigrationFiles>,
) {
  await connection.begin(async (transaction) => {
    for (const migration of migrations) {
      for (const statement of migration.sql) {
        if (statement.trim()) await transaction.unsafe(statement);
      }
    }
  });
}

function groupForm(name: string) {
  const form = new FormData();
  form.set("name", name);
  return form;
}

function contactForm(name: string, groupId?: number | null) {
  const form = new FormData();
  form.set("name", name);
  if (groupId !== undefined) form.set("groupId", groupId?.toString() ?? "");
  return form;
}

async function insertGroup(name: string) {
  const [group] = await database.insert(schema.groups)
    .values({ name, nameKey: name.toLocaleLowerCase("ru") }).returning();
  return group;
}

async function addContact(name: string, groupId: number | null) {
  await expect(createContact({}, contactForm(name, groupId))).rejects.toThrow(/Redirect: \/\?added=\d+/);
  const [contact] = await listContacts(name);
  return contact.id;
}

describe.runIf(Boolean(testDatabaseUrl))("groups with PostgreSQL", () => {
  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("GROUPS_TEST_DATABASE_URL is required");
    const url = new URL(testDatabaseUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Group integration tests require a local PostgreSQL server");
    }
    admin = postgres(url.toString());
    await admin`create database ${admin(databaseName)}`;
    url.pathname = `/${databaseName}`;
    const connection = postgres(url.toString());
    client = connection;
    database = drizzle(connection, { schema });

    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    await applyMigrations(connection, migrations.slice(0, 2));
    const [legacy] = await connection<{ id: number }[]>`
      insert into contacts (name, keep_in_touch_interval_days, next_contact_at)
      values ('Прежний контакт', 30, ${legacyDate.toISOString()}) returning id
    `;
    legacyId = legacy.id;
    await connection`insert into notes (contact_id, body) values (${legacyId}, 'Прежняя заметка')`;
    await applyMigrations(connection, migrations.slice(2));
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

  test("migration preserves existing contact, note and reminder without assigning a group", async () => {
    if (!client) throw new Error("Test database is unavailable");
    const [contact] = await client<{ name: string; next_contact_at: string; group_id: number | null }[]>`
      select name, next_contact_at, group_id from contacts where id = ${legacyId}
    `;
    expect(contact).toEqual({
      name: "Прежний контакт", next_contact_at: expect.any(String), group_id: null,
    });
    expect(new Date(contact.next_contact_at)).toEqual(legacyDate);
    expect(await getContactNotes(legacyId)).toEqual([
      expect.objectContaining({ body: "Прежняя заметка" }),
    ]);
  });

  test("created groups are stored, trimmed and listed in alphabetical order", async () => {
    expect(await createGroup({}, groupForm("Теннис"))).toHaveProperty("savedAt");
    expect(await createGroup({}, groupForm("  Семья  "))).toHaveProperty("savedAt");
    expect((await listGroups()).map(({ name }) => name)
      .filter((name) => name === "Семья" || name === "Теннис")).toEqual(["Семья", "Теннис"]);
  });

  test("concurrent duplicates with different case and spaces result in one group", async () => {
    const outcomes = await Promise.all([
      createGroup({}, groupForm("Друзья")),
      createGroup({}, groupForm("  друзья  ")),
    ]);
    expect(outcomes.filter((outcome) => outcome.savedAt)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.error)).toEqual([
      { error: "Группа с таким названием уже есть." },
    ]);
    expect((await listGroups()).filter(({ name }) => name.toLowerCase() === "друзья"))
      .toHaveLength(1);
  });

  test("a new contact can be assigned to a group", async () => {
    const group = await insertGroup("Группа при добавлении");
    const id = await addContact("Контакт с группой", group.id);

    expect(await getContact(id)).toMatchObject({ groupId: group.id, groupName: group.name });
  });

  test("a new contact can be saved without a group", async () => {
    const id = await addContact("Контакт без группы", null);

    expect(await getContact(id)).toMatchObject({ groupId: null, groupName: null });
  });

  test("editing replaces the previous group and saves other fields together", async () => {
    const first = await insertGroup("Исходная группа");
    const second = await insertGroup("Новая группа");
    const id = await addContact("Смена группы", first.id);

    await expect(updateContact(id, {}, contactForm("Новое имя", second.id)))
      .rejects.toThrow(`Redirect: /contacts/${id}?saved=1`);
    expect(await getContact(id)).toMatchObject({ name: "Новое имя", groupId: second.id, groupName: second.name });
  });

  test("editing can remove an assigned group", async () => {
    const group = await insertGroup("Снимаемая группа");
    const id = await addContact("Снятие группы", group.id);
    expect(await getContact(id)).toMatchObject({ groupId: group.id });

    await expect(updateContact(id, {}, contactForm("Снятие группы", null)))
      .rejects.toThrow(`Redirect: /contacts/${id}?saved=1`);
    expect(await getContact(id)).toMatchObject({ groupId: null, groupName: null });
  });

  test("invalid contact fields leave the previous group assigned", async () => {
    const first = await insertGroup("Сохранённая группа");
    const second = await insertGroup("Несохранённая группа");
    const id = await addContact("Имя обязательно", first.id);

    expect(await updateContact(id, {}, contactForm("  ", second.id))).toHaveProperty("errors.name");
    expect(await getContact(id)).toMatchObject({ name: "Имя обязательно", groupId: first.id });
  });

  test("unknown group ID leaves the rest of the contact unchanged", async () => {
    const group = await insertGroup("Проверка ссылки");
    const id = await addContact("Имя до ошибки", group.id);

    expect(await updateContact(id, {}, contactForm("Имя после ошибки", 2_147_483_647)))
      .toHaveProperty("errors.groupId");
    expect(await getContact(id)).toMatchObject({ name: "Имя до ошибки", groupId: group.id });
  });

  test("deleting a contact leaves its group available", async () => {
    const group = await insertGroup("Группа удалённого контакта");
    const id = await addContact("Удаляемый контакт", group.id);
    expect(await getContact(id)).toMatchObject({ groupId: group.id });

    await expect(deleteContact(id, {}, new FormData())).rejects.toThrow("Redirect: /?deleted=1");
    expect(await getContact(id)).toBeNull();
    expect(await listGroups()).toContainEqual({ id: group.id, name: group.name });
  });

  test("the unfiltered list includes assigned and unassigned contacts", async () => {
    const group = await insertGroup("Все контакты — проверка");
    const assignedId = await addContact("Общий список, в группе", group.id);
    const unassignedId = await addContact("Общий список, без группы", null);

    const ids = (await listContacts("Общий список")).map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining([assignedId, unassignedId]));
    expect((await listContacts("Общий список", "ungrouped")).map(({ id }) => id)).toEqual([unassignedId]);
  });

  test("an empty group remains selectable and returns no contacts", async () => {
    const group = await insertGroup("Пустая группа");
    expect(await listGroups()).toContainEqual({ id: group.id, name: group.name });
    expect(await listContacts("", group.id)).toEqual([]);
  });

  test("name search and group are applied together while reminders stay global", async () => {
    const group = await insertGroup("Область поиска");
    const firstId = await addContact("Ёлкин Антон", group.id);
    const secondId = await addContact("Елкина Марина", null);
    const thirdId = await addContact("Борис Соколов", group.id);

    for (const id of [firstId, secondId]) {
      await database.update(schema.contacts)
        .set({ keepInTouchIntervalDays: 30, nextContactAt: legacyDate })
        .where(eq(schema.contacts.id, id));
    }
    const now = new Date("2026-11-10T10:00:00.000Z");
    const reminders = await listKeepInTouchContacts(now);

    expect((await listContacts("елкин", group.id)).map(({ id }) => id)).toEqual([firstId]);
    expect((await listContacts("", group.id)).map(({ id }) => id)).toEqual([thirdId, firstId]);
    expect((await listContacts("елкин", null)).map(({ id }) => id))
      .toEqual(expect.arrayContaining([firstId, secondId]));
    expect(reminders.map(({ id }) => id)).toEqual(expect.arrayContaining([firstId, secondId]));
    expect(await listKeepInTouchContacts(now)).toEqual(reminders);
  });
});
