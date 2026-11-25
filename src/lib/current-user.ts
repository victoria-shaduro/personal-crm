import "server-only";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAuth } from "./auth";

export const currentUser = cache(async () => {
  await connection();
  const requestHeaders = new Headers(await headers());
  const session = await createAuth().api.getSession({
    headers: requestHeaders, query: { disableRefresh: true },
  });
  return session?.user;
});

export async function ownerId() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user.id;
}
