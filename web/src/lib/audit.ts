import type { PoolClient } from "pg";
import type { Viewer } from "@/auth/roles";
import { w } from "@/db/client";

export type AuditEntry = { action: string; targetType?: string; targetId?: string | number; before?: unknown; after?: unknown; ip?: string };

const SQL = `INSERT INTO web.audit_log (actor_id, actor_name, action, target_type, target_id, before, after, ip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
const args = (actor: Viewer, e: AuditEntry) => [actor?.id ?? null, actor ? `${actor.name} <${actor.email}>` : null, e.action, e.targetType ?? null,
  e.targetId == null ? null : String(e.targetId), e.before === undefined ? null : JSON.stringify(e.before), e.after === undefined ? null : JSON.stringify(e.after), e.ip || null];

export const audit = async (actor: Viewer, e: AuditEntry, c?: PoolClient) => { if (c) await c.query(SQL, args(actor, e)); else await w(SQL, args(actor, e)); };
