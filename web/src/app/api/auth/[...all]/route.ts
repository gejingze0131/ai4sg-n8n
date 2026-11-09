import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { env } from "@/lib/env";

// The library's own endpoints, with the two e-mail features behind their switches. Handoff names kept as aliases.
const ALIAS: Record<string, string> = { "/verify-email/send": "/send-verification-email", "/password-reset/request": "/request-password-reset", "/password-reset/confirm": "/reset-password" };
const VERIFY = ["/send-verification-email", "/verify-email"];
const RESET = ["/request-password-reset", "/forget-password", "/reset-password"];

function handle(req: NextRequest) {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^\/api\/auth/, "");
  const path = ALIAS[sub] ?? sub;
  const verifyOn = env.requireEmailVerification && env.mailEnabled;
  if ((VERIFY.some((p) => path.startsWith(p)) && !verifyOn) || (RESET.some((p) => path.startsWith(p)) && !env.mailEnabled)) {
    return NextResponse.json({ ok: false, error: "E-mail features are not switched on." }, { status: 501 });
  }
  if (path === sub) return auth.handler(req);
  url.pathname = `/api/auth${path}`;
  return auth.handler(new Request(url, req));
}

export const GET = handle;
export const POST = handle;
