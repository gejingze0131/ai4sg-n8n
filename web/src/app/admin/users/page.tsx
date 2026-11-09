import type { Metadata } from "next";
import { viewer } from "@/auth/session";
import { UsersTable } from "@/components/actions/AdminActions";
import { Pagination } from "@/components/ui";
import { w } from "@/db/client";
import { flatten, likePattern, Params, type RawParams } from "@/lib/filters";

export const metadata: Metadata = { title: "Users" };
const SIZE = 50;

export default async function Users({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = flatten(await searchParams);
  const v = await viewer();
  const p = new Params();
  const where: string[] = [];
  if (sp.q?.trim()) { const l = p.add(likePattern(sp.q.trim())); where.push(`(email ILIKE ${l} OR name ILIKE ${l})`); }
  if (sp.role === "pending") where.push("role = 'expert' AND NOT approved");
  else if (sp.role) where.push(`role = ${p.add(sp.role)}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [[total], users] = await Promise.all([
    w<{ n: number }>(`SELECT count(*)::int AS n FROM web.users ${clause}`, p.values),
    w(`SELECT id, name, email, role, approved, email_verified, created_at FROM web.users ${clause} ORDER BY created_at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`, p.values),
  ]);
  return (
    <section className="flex flex-col gap-3">
      <form className="flex flex-wrap gap-2" action="/admin/users">
        <input type="search" name="q" defaultValue={sp.q ?? ""} className="input flex-1 min-w-[220px]" placeholder="Search name or e-mail…" aria-label="Search users" />
        <select name="role" defaultValue={sp.role ?? ""} className="select" aria-label="Role"><option value="">All roles</option><option value="visitor">Visitors</option><option value="expert">Experts</option><option value="admin">Administrators</option><option value="pending">Experts waiting for approval</option></select>
        <button className="btn">Apply</button>
      </form>
      <UsersTable users={users} me={v!.id} />
      <Pagination total={total.n} page={page} pageSize={SIZE} base="/admin/users" params={sp} />
    </section>
  );
}
