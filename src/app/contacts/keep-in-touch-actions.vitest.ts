import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { addNote, markContacted, updateContact, updateKeepInTouch } from "./actions";

const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  lockContact: vi.fn(),
  insert: vi.fn(),
  insertValues: vi.fn(),
  update: vi.fn(),
  updateValues: vi.fn(),
  updateContact: vi.fn(),
  returning: vi.fn(),
}));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/db", () => ({ db }));
vi.mock("@/lib/log-db-error", () => ({ logDbError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));

const contactId = 42;
const savedAt = new Date("2026-11-16T11:00:00Z");
const weeklyDeadline = new Date("2026-11-23T11:00:00Z");

function formData(field: string, value: string) {
  const form = new FormData();
  form.set(field, value);
  return form;
}

function saveFrequency(value: string) {
  return updateKeepInTouch(contactId, {}, formData("intervalDays", value));
}

function saveNote(body: string) {
  return addNote(contactId, {}, formData("body", body));
}

function markContact() {
  return markContacted(contactId, {}, new FormData());
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(savedAt);
  db.transaction.mockImplementation(async (work) => work(db));
  db.select.mockReturnValue({ from: () => ({ where: () => ({ for: db.lockContact }) }) });
  db.lockContact.mockResolvedValue([{ id: contactId, keepInTouchIntervalDays: 7 }]);
  db.insert.mockReturnValue({ values: db.insertValues });
  db.insertValues.mockResolvedValue(undefined);
  db.update.mockReturnValue({ set: db.updateValues });
  db.updateValues.mockReturnValue({ where: db.updateContact });
  db.updateContact.mockReturnValue({ returning: db.returning });
  db.returning.mockResolvedValue([{ id: contactId }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saving a frequency", () => {
  test.each([
    ["7", 7, "2026-11-23T11:00:00Z"],
    ["30", 30, "2026-12-16T11:00:00Z"],
    ["90", 90, "2027-02-14T11:00:00Z"],
    ["365", 365, "2027-11-16T11:00:00Z"],
  ])("saving %s days starts a fresh term from the save time without adding a note", async (value, interval, deadline) => {
    await expect(saveFrequency(value)).resolves.toEqual({ savedAt: savedAt.getTime() });
    expect(db.updateValues).toHaveBeenCalledExactlyOnceWith({
      keepInTouchIntervalDays: interval,
      nextContactAt: new Date(deadline),
      updatedAt: savedAt,
    });
    expect(db.insert).not.toHaveBeenCalled();
    expect(revalidatePath.mock.calls).toEqual([[`/contacts/${contactId}`], ["/"]]);
  });

  test("saving the same frequency again replaces its deadline", async () => {
    await saveFrequency("7");
    const savedAgainAt = new Date("2026-11-18T09:30:00Z");
    vi.setSystemTime(savedAgainAt);
    await expect(saveFrequency("7")).resolves.toEqual({ savedAt: savedAgainAt.getTime() });

    expect(db.updateValues).toHaveBeenNthCalledWith(1, expect.objectContaining({ nextContactAt: weeklyDeadline }));
    expect(db.updateValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
      nextContactAt: new Date("2026-11-25T09:30:00Z"),
    }));
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("removing the frequency clears the deadline and reenabling it starts from the new save", async () => {
    await saveFrequency("7");
    await saveFrequency("");
    vi.setSystemTime(new Date("2026-11-20T11:00:00Z"));
    await saveFrequency("7");

    expect(db.updateValues).toHaveBeenNthCalledWith(2, expect.objectContaining({
      keepInTouchIntervalDays: null,
      nextContactAt: null,
    }));
    expect(db.updateValues).toHaveBeenNthCalledWith(3, expect.objectContaining({
      keepInTouchIntervalDays: 7,
      nextContactAt: new Date("2026-11-27T11:00:00Z"),
    }));
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("an invalid frequency does not write a schedule", async () => {
    await expect(saveFrequency("31")).resolves.toEqual({ error: "Выберите частоту из списка." });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("recording communication", () => {
  test.each([
    ["a manual note", () => saveNote("  Catch-up  "), "Catch-up"],
    ["a quick mark", markContact, "Связались"],
  ])("%s sets the deadline from the same instant as the note", async (_label, save, body) => {
    await expect(save()).resolves.toEqual({ savedAt: savedAt.getTime() });
    expect(db.insertValues).toHaveBeenCalledExactlyOnceWith({ contactId, body, createdAt: savedAt });
    expect(db.updateValues).toHaveBeenCalledExactlyOnceWith({ updatedAt: savedAt, nextContactAt: weeklyDeadline });
    expect(revalidatePath.mock.calls).toEqual([[`/contacts/${contactId}`], ["/"]]);
  });

  test.each([
    ["manual note", () => saveNote("Catch-up"), "Catch-up"],
    ["quick mark after the frequency was removed", markContact, "Связались"],
  ])("a %s leaves an unscheduled contact without a deadline", async (_label, save, body) => {
    db.lockContact.mockResolvedValue([{ id: contactId, keepInTouchIntervalDays: null }]);

    await expect(save()).resolves.toHaveProperty("savedAt");
    expect(db.insertValues).toHaveBeenCalledExactlyOnceWith({ contactId, body, createdAt: savedAt });
    expect(db.updateValues).toHaveBeenCalledExactlyOnceWith({ updatedAt: savedAt, nextContactAt: null });
  });

  test.each([
    ["blank", "   "],
    ["too long", "x".repeat(10_001)],
  ])("a %s note does not write or reschedule", async (_label, body) => {
    await expect(saveNote(body)).resolves.toEqual({ body, error: expect.any(String) });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saving around failures", () => {
  const actions = [
    ["frequency", () => saveFrequency("30")],
    ["note", () => saveNote("Catch-up")],
    ["quick mark", markContact],
  ] as const;

  test.each(actions)("a missing contact returns an error when saving a %s", async (_label, save) => {
    db.lockContact.mockResolvedValue([]);

    await expect(save()).resolves.toMatchObject({ error: "Контакт не найден." });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each(actions)("a failed %s save returns an error and can be retried", async (_label, save) => {
    db.transaction.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(save()).resolves.toMatchObject({ error: expect.stringContaining("попробуйте ещё раз") });
    expect(revalidatePath).not.toHaveBeenCalled();

    await expect(save()).resolves.toHaveProperty("savedAt");
    expect(revalidatePath.mock.calls).toEqual([[`/contacts/${contactId}`], ["/"]]);
  });
});

test("editing ordinary contact fields does not write a frequency or deadline", async () => {
  const form = formData("name", "New name");
  form.set("about", "New description");
  form.set("phone", "+7 999 123 45 67");
  form.set("email", "contact@example.com");
  form.set("howWeMet", "At work");

  await expect(updateContact(contactId, {}, form)).rejects.toThrow(`Redirect: /contacts/${contactId}?saved=1`);
  expect(db.updateValues).toHaveBeenCalledExactlyOnceWith({
    name: "New name",
    about: "New description",
    phone: "+7 999 123 45 67",
    email: "contact@example.com",
    howWeMet: "At work",
    updatedAt: savedAt,
  });
});
