import type { NextRequest } from "next/server";
import { auth } from "@/auth/auth";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = "/api/auth/sign-out";
  return auth.handler(new Request(url, req));
}
