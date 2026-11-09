import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { sendMail } from "./mailer";

function hosts() {
  const list = new Set(["localhost:3001", "127.0.0.1:3001"]);
  for (const u of [env.publicUrl, env.authUrl]) if (u) list.add(new URL(u).host);
  return [...list];
}
export const allowedHosts = hosts;

// Paths of the library that stay closed: sign-up goes through /api/auth/register, which checks the role and the reserved address.
const closed = ["/sign-up/email", "/update-user", "/change-email", "/delete-user"];

function create() {
  const verify = env.requireEmailVerification;
  return betterAuth({
    appName: "AI for Social Good",
    secret: env.authSecret,
    basePath: "/api/auth",
    baseURL: { allowedHosts: hosts(), fallback: env.authUrl, protocol: "auto" },
    trustedOrigins: [...new Set([env.authUrl, env.publicUrl, "http://localhost:3001", "http://127.0.0.1:3001"].filter(Boolean))],
    disabledPaths: closed,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications },
    }),
    user: {
      additionalFields: {
        // never taken from the request: only /api/auth/register and the administrators set these
        role: { type: "string", input: false, required: false, defaultValue: "visitor" },
        approved: { type: "boolean", input: false, required: false, defaultValue: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      requireEmailVerification: verify,
      sendResetPassword: async ({ user, url }) => { await sendMail(user.email, "Reset your password", `Open this link to choose a new password:\n\n${url}\n`); },
    },
    emailVerification: {
      sendOnSignUp: verify,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => { await sendMail(user.email, "Confirm your e-mail address", `Open this link to confirm your address:\n\n${url}\n`); },
    },
    rateLimit: { enabled: true, window: 60, max: 200, customRules: { "/sign-in/email": { window: 60, max: 10 }, "/change-password": { window: 60, max: 10 } } },
    advanced: {
      useSecureCookies: (env.publicUrl || env.authUrl).startsWith("https://"),
      trustedProxyHeaders: true,
    },
  });
}

type Auth = ReturnType<typeof create>;
const g = globalThis as unknown as { __auth?: Auth };
export const getAuth = (): Auth => (g.__auth ??= create());
export const auth = new Proxy({} as Auth, { get: (_t, k) => (getAuth() as any)[k] });
