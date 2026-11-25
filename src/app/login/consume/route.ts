import { consumeLogin } from "@/lib/login";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin) {
    return new Response(null, { status: 403 });
  }
  const token = await request.text();
  const cookies = token.length <= 256 && await consumeLogin(token, request.headers);
  const response = new Response(null, { status: cookies ? 204 : 400 });
  if (cookies) for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}
