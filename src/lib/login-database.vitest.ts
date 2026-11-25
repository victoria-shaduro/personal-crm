import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/db/schema";
import { createAuth } from "./auth";
import { consumeLogin, requestLogin } from "./login";
import { sendLoginMail } from "./login-mail";

let database: ReturnType<typeof drizzle<typeof schema>>;
let client: postgres.Sql;
let admin: postgres.Sql;
const name = "login_test_" + randomUUID().replaceAll("-", "");
const url = process.env.GROUPS_TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ get db() { return database; } }));
vi.mock("./login-mail", async (load) => ({
  ...await load<typeof import("./login-mail")>(), sendLoginMail: vi.fn(),
}));

const request = new Headers({ origin: "http://127.0.0.1:3000" });
const address = () => randomUUID() + "@example.org";
async function issue(email: string) {
  expect(await requestLogin(email, request)).toBe(`Ссылка для входа отправлена на ${email.trim().toLowerCase()}`);
  return vi.mocked(sendLoginMail).mock.lastCall![1];
}

describe.runIf(Boolean(url))("login with PostgreSQL", () => {
  beforeAll(async () => {
    const target = new URL(url!);
    if (!["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("Local database required");
    admin = postgres(target.href);
    await admin`create database ${admin(name)}`;
    target.pathname = "/" + name;
    client = postgres(target.href, { connection: { "crm.owner_email": "owner@example.org" } });
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "drizzle" });
    vi.stubEnv("BETTER_AUTH_URL", request.get("origin")!);
    vi.stubEnv("BETTER_AUTH_SECRET", randomUUID());
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  afterAll(async () => {
    await client?.end();
    if (admin) { await admin`drop database ${admin(name)}`; await admin.end(); }
    vi.unstubAllEnvs();
  });

  test("invalid input is rejected before delivery", async () => {
    expect(await requestLogin("broken", request)).toBe("Проверь адрес почты");
    expect(sendLoginMail).not.toHaveBeenCalled();
  });
  test("a new successful delivery replaces the link and only one concurrent redemption succeeds", async () => {
    const email = address();
    const old = await issue(email);
    const token = await issue(" " + email.toUpperCase() + " ");
    expect(await consumeLogin(old, request)).toBeNull();
    const results = await Promise.all([consumeLogin(token, request), consumeLogin(token, request)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await issue(email);
  });
  test("a failed delivery preserves the previous link", async () => {
    const email = address();
    const token = await issue(email);
    vi.mocked(sendLoginMail).mockRejectedValueOnce(new Error("SMTP unavailable"));
    expect(await requestLogin(email, request)).toBe("Не получилось отправить ссылку. Попробуй ещё раз");
    expect(await consumeLogin(token, request)).toBeTruthy();
  });
  test("the link expires after fifteen minutes", async () => {
    const token = await issue(address());
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 15 * 60000);
    expect(await consumeLogin(token, request)).toBeNull();
  });
  test("concurrent sends obey the rolling per-address limit", async () => {
    const email = address();
    const results = await Promise.all(Array.from({ length: 4 }, () => requestLogin(email, request)));
    expect(results.filter(result => result.startsWith("Слишком часто"))).toHaveLength(1);
    expect(sendLoginMail).toHaveBeenCalledTimes(3);
    const token = vi.mocked(sendLoginMail).mock.lastCall![1];
    expect(await consumeLogin(token, request)).toBeTruthy();
    await issue(address());
    await client`update mail_delivery set sent_at = now() - interval '10 minutes' where email = ${email}`;
    await issue(email);
  });
  test("a visit renews the database and browser session, thirty idle days expire it", async () => {
    const cookies = await consumeLogin(await issue(address()), request);
    const headers = new Headers({ cookie: cookies!.map(c => c.split(";")[0]).join("; ") });
    const auth = createAuth();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 29 * 86400000);
    const refreshed = await auth.api.getSession({ headers, returnHeaders: true });
    expect(refreshed.response!.session.expiresAt.getTime()).toBe(Date.now() + 30 * 86400000);
    expect(refreshed.headers.getSetCookie().join(" ")).toContain("Max-Age=2592000");
    vi.setSystemTime(Date.now() + 30 * 86400000 + 1);
    expect(await auth.api.getSession({ headers })).toBeNull();
  });
});
