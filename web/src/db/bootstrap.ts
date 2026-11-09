import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { auth } from "@/auth/auth";
import { env } from "@/lib/env";
import { db } from "./client";
import { users } from "./schema";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureAdmin() {
  const email = env.adminEmail;
  if (!email) { console.warn("[web] ADMIN_EMAIL is not set: there is no administrator yet"); return; }
  const [existing] = await db().select().from(users).where(eq(users.email, email));
  if (existing) {
    if (existing.role !== "admin" || !existing.approved) await db().update(users).set({ role: "admin", approved: true }).where(eq(users.id, existing.id));
    return;
  }
  const password = env.adminInitialPassword;
  if (!password) { console.warn("[web] ADMIN_INITIAL_PASSWORD is not set: the first administrator was not created"); return; }
  await auth.api.signUpEmail({ body: { email, password, name: "Administrator" } });
  await db().update(users).set({ role: "admin", approved: true, emailVerified: true }).where(eq(users.email, email));
  console.log("[web] first administrator created");
}

export async function bootstrap() {
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db(), { migrationsFolder: path.join(process.cwd(), "drizzle"), migrationsSchema: "web", migrationsTable: "__migrations" });
      await ensureAdmin();
      return;
    } catch (e) {
      if (attempt >= 10) throw e;
      console.warn(`[web] database not ready (attempt ${attempt}): ${(e as Error).message}`);
      await wait(3000);
    }
  }
}
