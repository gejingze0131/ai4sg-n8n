import { w } from "@/db/client";
import { route } from "@/lib/api";
import { likePattern, Params } from "@/lib/filters";

const SIZE = 50;

export const GET = route({ role: "admin" }, async ({ req }) => {
  const s = req.nextUrl.searchParams;
  const p = new Params();
  const where: string[] = [];
  const text = s.get("q")?.trim();
  if (text) { const like = p.add(likePattern(text)); where.push(`(email ILIKE ${like} OR name ILIKE ${like})`); }
  const role = s.get("role");
  if (role === "pending") where.push(`role = 'expert' AND NOT approved`);
  else if (role) where.push(`role = ${p.add(role)}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Number(s.get("page")) || 1);
  const [total] = await w<{ n: number }>(`SELECT count(*)::int AS n FROM web.users ${clause}`, p.values);
  const items = await w(`SELECT id, name, email, role, approved, email_verified, created_at FROM web.users ${clause} ORDER BY created_at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`, p.values);
  return { total: total.n, page, pageSize: SIZE, items };
});
