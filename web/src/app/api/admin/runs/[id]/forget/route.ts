import { q1, tx, w } from "@/db/client";
import { HttpError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { activeRun, type JobRow, updateJobFromPipeline } from "@/lib/jobs";
import { pipeline } from "@/pipeline";

const runId = (s: string) => {
  const id = Number(s);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Bad run id.");
  return id;
};

// what would be taken out
export const GET = route<{ id: string }>({ role: "admin" }, async ({ params }) => (await w(`SELECT ai4sg_forget_run_preview($1) AS p`, [runId(params.id)]))[0].p);

export const POST = route<{ id: string }>({ role: "admin" }, async ({ params, viewer, ip }) => {
  const id = runId(params.id);
  if (await activeRun()) throw new HttpError(409, "A run is in progress. Wait for it to finish first.");
  if (!(await q1(`SELECT 1 AS ok FROM api.run_cards WHERE id = $1`, [id]))) throw new HttpError(404, "Run not found.");
  const [job] = await w<JobRow>(`INSERT INTO web.jobs (type, params, requested_by, requester_name, status, started_at) VALUES ('forget_run', $1, $2, $3, 'running', now()) RETURNING *`, [JSON.stringify({ run_id: id }), viewer!.id, viewer!.name]);
  let out: { source_ids: number[]; extractions: number; projects: number; tools: number };
  try {
    out = await tx(async (c) => {
      const r = (await c.query(`SELECT ai4sg_forget_run($1) AS r`, [id])).rows[0].r;
      await audit(viewer, { action: "run.forget", targetType: "run", targetId: id, after: { sources: r.source_ids.length, extractions: r.extractions, projects: r.projects, tools: r.tools }, ip }, c);
      return r;
    });
  } catch (e) {
    await updateJobFromPipeline(job.id, { status: "failed", error: (e as Error).message });
    throw e;
  }
  const counts = { sources: out.source_ids.length, extractions: out.extractions, projects: out.projects, tools: out.tools };
  try {
    const { moved } = await pipeline.forgetRun(job.id, id, out.source_ids);
    await updateJobFromPipeline(job.id, { status: "done", result: { ...counts, folders_moved: moved } });
    return { ok: true, ...counts, folders_moved: moved, job_id: job.id };
  } catch (e) {
    const message = `The run was taken out of the database (copies in schema archive), but its files were not moved: ${(e as Error).message}`;
    await updateJobFromPipeline(job.id, { status: "failed", result: counts, error: message });
    throw new HttpError(502, message);
  }
});
