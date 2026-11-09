import { w } from "@/db/client";
import { route } from "@/lib/api";
import { likePattern, Params } from "@/lib/filters";

const SIZE = 50;

export const GET = route({ role: "admin" }, async ({ req }) => {
  const s = req.nextUrl.searchParams;
  const p = new Params();
  const where: string[] = [];
  const action = s.get("action");
  if (action) where.push(`action ILIKE ${p.add(likePattern(action))}`);
  const actor = s.get("actor");
  if (actor) where.push(`actor_name ILIKE ${p.add(likePattern(actor))}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Number(s.get("page")) || 1);
  const [total] = await w<{ n: number }>(`SELECT count(*)::int AS n FROM web.audit_log ${clause}`, p.values);
  const items = await w(`SELECT * FROM web.audit_log ${clause} ORDER BY at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`, p.values);
  return { total: total.n, page, pageSize: SIZE, items };
});
