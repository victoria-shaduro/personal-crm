import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { addNote, deleteContact, markContacted, updateKeepInTouch } from "@/app/contacts/actions";
import * as schema from "@/db/schema";
import { getContact, getContactNotes, listContacts, listKeepInTouchContacts } from "@/lib/contacts";

const testDatabaseUrl = process.env.GROUPS_TEST_DATABASE_URL;
const databaseName = `keep_in_touch_test_${randomUUID().replaceAll("-", "")}`;
const now = new Date("2026-11-16T11:00:00Z");
const dayMs = 86_400_000;
let admin: postgres.Sql | undefined;
let client: postgres.Sql;
let database: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ get db() { return database; } }));
vi.mock("@/lib/log-db-error", () => ({ logDbError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));

function moment(days: number) {
  return new Date(now.getTime() + days * dayMs);
}

async function addContact(name: string, deadline: Date | null = null, interval = 7) {
  const [contact] = await database.insert(schema.contacts).values({
    name,
    ...(deadline ? { keepInTouchIntervalDays: interval, nextContactAt: deadline } : {}),
  }).returning({ id: schema.contacts.id });
  return contact.id;
}

function saveFrequency(id: number, value: string) {
  const form = new FormData();
  form.set("intervalDays", value);
  return updateKeepInTouch(id, {}, form);
}

function saveNote(id: number, body: string) {
  const form = new FormData();
  form.set("body", body);
  return addNote(id, {}, form);
}

function quickMark(id: number) {
  return markContacted(id, {}, new FormData());
}

describe.runIf(Boolean(testDatabaseUrl))("keep in touch with PostgreSQL", () => {
  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("A PostgreSQL test URL is required");
    const url = new URL(testDatabaseUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Keep-in-touch tests require a local PostgreSQL server");
    }
    admin = postgres(url.toString());
    await admin`create database ${admin(databaseName)}`;
    url.pathname = `/${databaseName}`;
    client = postgres(url.toString());
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await database.delete(schema.contacts);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  test("contacts without a frequency have no deadline and stay out of the reminder list", async () => {
    expect(await listKeepInTouchContacts()).toEqual([]);
    const id = await addContact("No frequency");
    await expect(saveNote(id, "Catch-up")).resolves.toHaveProperty("savedAt");

    expect(await getContact(id)).toMatchObject({ keepInTouchIntervalDays: null, nextContactAt: null });
    expect(await getContactNotes(id)).toMatchObject([{ body: "Catch-up" }]);
    expect(await listKeepInTouchContacts()).toEqual([]);
  });

  test("the reminder query treats the exact deadline as upcoming and reevaluates it on the next load", async () => {
    const id = await addContact("Deadline", now);
    vi.setSystemTime(now.getTime() - 1);
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: false }]);
    vi.setSystemTime(now);
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: false }]);
    vi.setSystemTime(now.getTime() + 1);
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: true }]);
  });

  test.each([
    { name: "four future contacts", overdueDays: [], futureDays: [4, 1, 3, 2], expectedDays: [1, 2] },
    { name: "one future contact", overdueDays: [], futureDays: [1], expectedDays: [1] },
    { name: "five overdue contacts", overdueDays: [-5, -3, -30, -2, -7], futureDays: [], expectedDays: [-30, -7, -5, -3, -2] },
    { name: "five overdue and three future contacts", overdueDays: [-5, -3, -30, -2, -7], futureDays: [3, 2, 1], expectedDays: [-30, -7, -5, -3, -2, 1, 2] },
  ])("the reminder list has the expected order and size with $name", async ({ overdueDays, futureDays, expectedDays }) => {
    const idByDay = new Map<number, number>();
    for (const days of [...futureDays, ...overdueDays]) {
      const interval = days === -30 ? 365 : 7;
      idByDay.set(days, await addContact(`Contact ${days}`, moment(days), interval));
    }
    await addContact("No deadline");

    expect((await listKeepInTouchContacts()).map(({ id, overdue }) => ({ id, overdue }))).toEqual(
      expectedDays.map((days) => ({ id: idByDay.get(days), overdue: days < 0 })),
    );
  });

  test("a search for another contact or for no results preserves reminder membership and order", async () => {
    const otherId = await addContact("Other person");
    const secondId = await addContact("Second reminder", moment(2));
    const overdueId = await addContact("Overdue reminder", moment(-1));
    const firstId = await addContact("First reminder", moment(1));
    await addContact("Later reminder", moment(3));

    const expectedIds = [overdueId, firstId, secondId];
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual(expectedIds);
    expect((await listContacts("Other person")).map(({ id }) => id)).toEqual([otherId]);
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual(expectedIds);
    expect(await listContacts("Unknown name")).toEqual([]);
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual(expectedIds);
  });

  test("the first save ignores old notes and removal preserves them", async () => {
    vi.setSystemTime(moment(-20));
    const id = await addContact("Contact with history");
    await saveNote(id, "Old note");

    vi.setSystemTime(now);
    await expect(saveFrequency(id, "7")).resolves.toHaveProperty("savedAt");
    expect(await getContact(id)).toMatchObject({ keepInTouchIntervalDays: 7, nextContactAt: moment(7) });
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: false }]);

    await expect(saveFrequency(id, "")).resolves.toHaveProperty("savedAt");
    expect(await getContact(id)).toMatchObject({ keepInTouchIntervalDays: null, nextContactAt: null });
    expect(await getContactNotes(id)).toMatchObject([{ body: "Old note", createdAt: moment(-20) }]);
    expect(await listKeepInTouchContacts()).toEqual([]);
  });

  test("manual and automatic notes use the latest successful save to replace the deadline", async () => {
    const id = await addContact("Overdue contact", moment(-1));

    await expect(saveNote(id, "First conversation")).resolves.toHaveProperty("savedAt");
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: false, nextContactAt: moment(7) }]);

    vi.setSystemTime(moment(1));
    await expect(quickMark(id)).resolves.toHaveProperty("savedAt");
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, nextContactAt: moment(8) }]);

    vi.setSystemTime(moment(2));
    await expect(saveNote(id, "Latest conversation")).resolves.toHaveProperty("savedAt");
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, nextContactAt: moment(9) }]);
    expect(await getContactNotes(id)).toMatchObject([
      { body: "Latest conversation", createdAt: moment(2) },
      { body: "Связались", createdAt: moment(1) },
      { body: "First conversation", createdAt: now },
    ]);
  });

  test("a mark from a stale list uses the current frequency after it was removed", async () => {
    const id = await addContact("Stale reminder", moment(1));
    expect(await listKeepInTouchContacts()).toMatchObject([{ id }]);
    await saveFrequency(id, "");

    await expect(quickMark(id)).resolves.toHaveProperty("savedAt");
    expect(await getContactNotes(id)).toMatchObject([{ body: "Связались", createdAt: now }]);
    expect(await getContact(id)).toMatchObject({ keepInTouchIntervalDays: null, nextContactAt: null });
    expect(await listKeepInTouchContacts()).toEqual([]);
  });

  test("editing the frequency or deleting a reminder brings the next eligible contact into the list", async () => {
    const firstId = await addContact("First", moment(1));
    const secondId = await addContact("Second", moment(2));
    const thirdId = await addContact("Third", moment(3));
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual([firstId, secondId]);

    await expect(saveFrequency(firstId, "30")).resolves.toHaveProperty("savedAt");
    expect(await getContact(firstId)).toMatchObject({ nextContactAt: moment(30) });
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual([secondId, thirdId]);

    await expect(deleteContact(secondId, {}, new FormData())).rejects.toThrow("Redirect: /?deleted=1");
    expect((await listKeepInTouchContacts()).map(({ id }) => id)).toEqual([thirdId, firstId]);
  });

  test.each([
    ["frequency", (id: number) => saveFrequency(id, "30"), []],
    ["manual note", (id: number) => saveNote(id, "Catch-up"), ["Catch-up"]],
    ["quick mark", quickMark, ["Связались"]],
  ] as const)("a failed %s write preserves the previous schedule and notes and allows a retry", async (_label, save, newNotes) => {
    const id = await addContact("Overdue contact", moment(-1));
    await database.insert(schema.notes).values({ contactId: id, body: "Previous note", createdAt: moment(-8) });
    await client`alter table contacts add constraint test_reject_future_deadlines
      check (next_contact_at < '2026-11-16T11:00:00Z'::timestamptz)`;

    try {
      await expect(save(id)).resolves.toMatchObject({ error: expect.any(String) });
      expect(await getContact(id)).toMatchObject({ keepInTouchIntervalDays: 7, nextContactAt: moment(-1) });
      expect(await getContactNotes(id)).toMatchObject([{ body: "Previous note", createdAt: moment(-8) }]);
    } finally {
      await client`alter table contacts drop constraint test_reject_future_deadlines`;
    }

    await expect(save(id)).resolves.toHaveProperty("savedAt");
    expect((await getContactNotes(id)).map(({ body }) => body)).toEqual([...newNotes, "Previous note"]);
    expect(await listKeepInTouchContacts()).toMatchObject([{ id, overdue: false }]);
  });
});
