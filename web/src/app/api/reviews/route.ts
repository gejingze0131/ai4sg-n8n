import { tx } from "@/db/client";
import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { reviewBody } from "@/lib/validators";

export const POST = route({ role: "expert", body: reviewBody }, async ({ body, viewer, ip }) => {
  const row = await tx(async (c) => {
    const before = (await c.query(`SELECT review_decision, reviewer, review_comment FROM api.source_cards WHERE id = $1`, [body.source_id])).rows[0];
    const r = (await c.query(`SELECT * FROM ai4sg_save_review($1, $2, $3, $4, $5)`, [body.source_id, body.decision, body.comment, viewer!.name, viewer!.id])).rows[0];
    await audit(viewer, { action: "review.save", targetType: "source", targetId: body.source_id, before, after: { decision: r.decision, comment: r.comment, extraction_id: r.extraction_id }, ip }, c);
    return r;
  });
  return { ok: true, ...row };
});
