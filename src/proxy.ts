import { NextResponse, type NextRequest } from "next/server";
import { createAuth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await createAuth().api.getSession({ headers: request.headers, returnHeaders: true });
  const response = session.response ? NextResponse.next() : NextResponse.redirect(new URL("/login", process.env.BETTER_AUTH_URL));
  for (const cookie of session.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/", "/groups/:path*", "/contacts/:path*"] };
