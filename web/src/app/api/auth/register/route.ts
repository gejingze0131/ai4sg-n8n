import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { HttpError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { allow } from "@/lib/ratelimit";
import { registerBody } from "@/lib/validators";

export const POST = route({ role: "public", body: registerBody }, async ({ body, req, ip }) => {
  const b = body as { email: string; password: string; name: string; role: string };
  if (b.role !== "visitor" && b.role !== "expert") throw new HttpError(403, "You can register as a visitor or an expert.");
  if (!allow(`register:${ip}`, 20, 3600_000)) throw new HttpError(429, "Too many sign-ups from this address. Try again later.");
  const email = b.email.trim().toLowerCase();
  if (env.adminEmail && email === env.adminEmail) throw new HttpError(403, "This address is reserved. Sign in instead.");

  let out;
  try {
    out = await auth.api.signUpEmail({ body: { email, password: b.password, name: b.name }, headers: req.headers, returnHeaders: true });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status && status < 500) throw new HttpError(status === 422 ? 409 : status, (e as Error).message);
    throw e;
  }
  const approved = b.role === "visitor" || env.expertSignup === "open";
  await db().update(users).set({ role: b.role, approved }).where(eq(users.id, out.response.user.id));
  await audit({ id: out.response.user.id, name: b.name, email, role: "visitor", requestedRole: "visitor", approved }, { action: "user.register", targetType: "user", targetId: out.response.user.id, after: { role: b.role, approved }, ip });

  const res = NextResponse.json({ ok: true, role: approved ? b.role : "visitor", pending_approval: !approved, verify_email: env.requireEmailVerification });
  for (const c of out.headers.getSetCookie()) res.headers.append("set-cookie", c);
  return res;
});
