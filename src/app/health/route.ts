import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };

  try {
    // Check both the connection and the tables created by our migrations.
    await db.execute(sql`
      select (select 1 from contacts limit 1), (select 1 from notes limit 1)
    `);
    return Response.json(
      { status: "ok", revision: process.env.APP_REVISION ?? "development" },
      { headers },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
