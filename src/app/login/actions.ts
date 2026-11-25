"use server";
import { redirect } from "next/navigation";
import { createAuth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { requestLogin } from "@/lib/login";

export async function submitEmail(_previous: string, form: FormData) {
  return requestLogin(form.get("email"), new Headers(await headers()));
}

export async function logout() {
  const auth = createAuth();
  await auth.api.signOut({ headers: new Headers(await headers()) });
  const ctx = await auth.$context;
  (await cookies()).delete(ctx.authCookies.sessionToken.name);
  redirect("/login");
}
