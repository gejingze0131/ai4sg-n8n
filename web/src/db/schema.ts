import { sql } from "drizzle-orm";
import { bigserial, boolean, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// The website's own tables. The pipeline's tables stay in schema public; the website reads them through the views in schema api
// (../db/web-schema.sql) and changes them only through the ai4sg_* database functions.
export const web = pgSchema("web");

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = web.table("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("visitor"),     // visitor | expert | admin
  approved: boolean("approved").notNull().default(true), // false: asked to be an expert, waiting (EXPERT_SIGNUP=approval)
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const sessions = web.table("sessions", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const accounts = web.table("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("accounts_user_idx").on(t.userId)]);

export const verifications = web.table("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("verifications_identifier_idx").on(t.identifier)]);

// every request that needs the pipeline
export const jobs = web.table("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),                     // run | analyse | rescreen | organise | resummarise | forget_run
  params: jsonb("params").notNull().default({}),
  requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
  requesterName: text("requester_name"),
  status: text("status").notNull().default("queued"), // queued | running | done | failed
  n8nExecutionId: text("n8n_execution_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  result: jsonb("result"),
  error: text("error"),
}, (t) => [
  index("jobs_requester_idx").on(t.requestedBy, t.createdAt),
  index("jobs_status_idx").on(t.status, t.createdAt),
  uniqueIndex("jobs_one_active_run").on(t.type).where(sql`type = 'run' AND status IN ('queued', 'running')`),
]);

// every write, by whom
export const auditLog = web.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
}, (t) => [index("audit_at_idx").on(t.at), index("audit_actor_idx").on(t.actorId, t.at)]);
