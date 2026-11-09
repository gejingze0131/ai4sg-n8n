import type { NextRequest } from "next/server";
import { auth } from "@/auth/auth";

// the library's sign-in, under the name the site uses (its checks and rate limit still apply)
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = "/api/auth/sign-in/email";
  return auth.handler(new Request(url, req));
}
