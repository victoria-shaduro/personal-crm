import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });

try {
  const [table] = await client`select to_regclass('drizzle.__drizzle_migrations') as name`;
  const before = table.name
    ? Number((await client`select count(*) as count from drizzle.__drizzle_migrations`)[0].count)
    : 0;
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  const [after] = await client`select count(*) as count from drizzle.__drizzle_migrations`;
  console.log(`Migrations completed: ${before} -> ${after.count} (${Number(after.count) - before} applied).`);
} catch (error) {
  // Raw driver errors can contain connection details. Keep them out of CI logs.
  console.error("Migrations failed.", { code: error.cause?.code ?? error.code ?? "unknown" });
  process.exitCode = 1;
} finally {
  await client.end();
}
