import { tx } from "@/db/client";
import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requestResummary } from "@/lib/jobs";
import { moveBody } from "@/lib/validators";

export const POST = route({ role: "expert", body: moveBody }, async ({ body, viewer, ip }) => {
  const r = await tx(async (c) => {
    const before = (await c.query(`SELECT project_code FROM api.source_cards WHERE id = $1`, [body.source_id])).rows[0];
    const row = (await c.query(`SELECT * FROM ai4sg_move_source($1, $2, $3)`, [body.source_id, body.target, viewer!.name])).rows[0];
    await audit(viewer, { action: "source.move", targetType: "source", targetId: body.source_id, before, after: { project_code: row.code }, ip }, c);
    return row;
  });
  const job = await requestResummary(r.project_ids, viewer, ip);
  return { ok: true, code: r.code, name: r.name, job_id: job?.id };
});
