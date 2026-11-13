// Adds separate, labelled local fixtures without changing existing contacts.
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts } from "../src/db/schema";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const hostname = new URL(databaseUrl).hostname;
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("Keep-in-touch fixtures require a local database");
  }
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
  try {
    const db = drizzle(client);
    const now = Date.now();
    const fixtures = [
      { name: "Ольга Лебедева", interval: 365, offset: -30 },
      { name: "Михаил Соколов", interval: 7, offset: -1 },
      { name: "Мария Кузнецова", interval: 90, offset: -1 },
      { name: "Анна Смирнова", interval: 30, offset: 1 },
      { name: "Александра Константиновна Рождественская", interval: 7, offset: 1 },
      { name: "Елена Морозова", interval: 90, offset: 3 },
      { name: "Алексей Петров", interval: null, offset: null },
    ];
    const added = await db.insert(contacts).values(fixtures.map((fixture) => ({
      name: fixture.name,
      about: "Локальный тестовый контакт для проверки расписания",
      keepInTouchIntervalDays: fixture.interval,
      nextContactAt: fixture.offset === null ? null : new Date(now + fixture.offset * 86_400_000),
    }))).returning({ id: contacts.id, name: contacts.name });
    console.log("Added keep-in-touch fixtures:", added);
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Failed to add keep-in-touch fixtures. Check the local database connection.");
  process.exitCode = 1;
});
