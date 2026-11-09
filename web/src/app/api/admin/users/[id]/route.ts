import { tx } from "@/db/client";
import { HttpError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { userPatchBody } from "@/lib/validators";

export const PATCH = route<{ id: string }>({ role: "admin", body: userPatchBody }, async ({ params, body, viewer, ip }) => {
  const b = body as { role?: string; approved?: boolean };
  return tx(async (c) => {
    const before = (await c.query(`SELECT role, approved FROM web.users WHERE id = $1 FOR UPDATE`, [params.id])).rows[0];
    if (!before) throw new HttpError(404, "User not found.");
    if (before.role === "admin" && b.role && b.role !== "admin") {
      const n = (await c.query(`SELECT count(*)::int AS n FROM web.users WHERE role = 'admin'`)).rows[0].n;
      if (n <= 1) throw new HttpError(400, "This is the last administrator.");
    }
    const role = b.role ?? before.role;
    const approved = b.approved ?? (b.role ? true : before.approved);
    await c.query(`UPDATE web.users SET role = $2, approved = $3, updated_at = now() WHERE id = $1`, [params.id, role, approved]);
    await audit(viewer, { action: "user.update", targetType: "user", targetId: params.id, before, after: { role, approved }, ip }, c);
    return { ok: true, role, approved };
  });
});
