import { tx } from "@/db/client";
import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requestResummary } from "@/lib/jobs";
import { mergeBody } from "@/lib/validators";

export const POST = route({ role: "expert", body: mergeBody }, async ({ body, viewer, ip }) => {
  const r = await tx(async (c) => {
    const row = (await c.query(`SELECT * FROM ai4sg_merge_projects($1, $2, $3)`, [body.project, body.target, viewer!.name])).rows[0];
    await audit(viewer, { action: "project.merge", targetType: "project", targetId: body.project, after: { into: row.code }, ip }, c);
    return row;
  });
  const job = await requestResummary(r.project_ids, viewer, ip);
  return { ok: true, code: r.code, name: r.name, job_id: job?.id };
});
