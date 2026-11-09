import type { Viewer } from "@/auth/roles";
import { tx, w } from "@/db/client";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/api";
import { pipeline } from "@/pipeline";

export type JobRow = { id: string; type: string; params: any; requested_by: string | null; requester_name: string | null; status: string; n8n_execution_id: string | null; created_at: string; started_at: string | null; finished_at: string | null; result: any; error: string | null };

const label = (v: Viewer) => (v ? v.name : "");

async function failJob(id: string, message: string) {
  await w(`UPDATE web.jobs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1 AND status IN ('queued', 'running')`, [id, message]);
}

// Records the request, then hands it to the pipeline. When the pipeline cannot take it, the job is marked failed and the caller is told.
async function dispatch(job: JobRow, send: () => Promise<void>) {
  try {
    await send();
  } catch (e) {
    await failJob(job.id, (e as Error).message);
    throw new HttpError(502, (e as Error).message);
  }
  return job;
}

export async function requestAnalysis(ids: number[], v: NonNullable<Viewer>, ip: string) {
  const { job, sent, skipped } = await tx(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('web.jobs.analyse'))`);   // two requests at once cannot both take a source
    const busy = (await c.query<{ id: string }>(`SELECT DISTINCT x AS id FROM web.jobs j, jsonb_array_elements_text(j.params->'source_ids') x WHERE j.type = 'analyse' AND j.status IN ('queued', 'running')`)).rows.map((r) => Number(r.id));
    const sent = [...new Set(ids)].filter((id) => !busy.includes(id));
    const skipped = ids.filter((id) => busy.includes(id));
    if (!sent.length) return { job: null, sent, skipped };
    const job = (await c.query<JobRow>(`INSERT INTO web.jobs (type, params, requested_by, requester_name) VALUES ('analyse', $1, $2, $3) RETURNING *`, [JSON.stringify({ source_ids: sent }), v.id, label(v)])).rows[0];
    await audit(v, { action: "analysis.request", targetType: "job", targetId: job.id, after: { source_ids: sent, skipped }, ip }, c);
    return { job, sent, skipped };
  });
  if (!job) throw new HttpError(409, "These sources are already being analysed.");
  await dispatch(job, () => pipeline.analyse(job.id, sent, label(v)));
  return { job, sent, skipped };
}

export async function requestResummary(projectIds: number[], v: Viewer, ip: string) {
  const ids = [...new Set(projectIds.map(Number))].filter(Boolean);
  if (!ids.length) return null;
  const [job] = await w<JobRow>(`INSERT INTO web.jobs (type, params, requested_by, requester_name) VALUES ('resummarise', $1, $2, $3) RETURNING *`, [JSON.stringify({ project_ids: ids }), v?.id ?? null, label(v)]);
  await audit(v, { action: "summary.request", targetType: "job", targetId: job.id, after: { project_ids: ids }, ip });
  // the change itself is saved; if the pipeline is down the summaries are rewritten at the end of the next run
  try { await pipeline.resummarise(job.id, ids); } catch (e) { await failJob(job.id, (e as Error).message); }
  return job;
}

export async function requestSimple(type: "rescreen" | "organise", params: Record<string, unknown>, v: NonNullable<Viewer>, ip: string, send: (jobId: string) => Promise<void>) {
  const [job] = await w<JobRow>(`INSERT INTO web.jobs (type, params, requested_by, requester_name) VALUES ($1, $2, $3, $4) RETURNING *`, [type, JSON.stringify(params), v.id, label(v)]);
  await audit(v, { action: `${type}.request`, targetType: "job", targetId: job.id, after: params, ip });
  return dispatch(job, () => send(job.id));
}

export async function requestRun(settings: Record<string, unknown>, v: NonNullable<Viewer>, ip: string, send: (jobId: string) => Promise<void>) {
  await reconcileJobs();
  let job: JobRow;
  try {
    [job] = await w<JobRow>(`INSERT INTO web.jobs (type, params, requested_by, requester_name) VALUES ('run', $1, $2, $3) RETURNING *`, [JSON.stringify(settings), v.id, label(v)]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "A run is already in progress. Only one run can go at a time.");
    throw e;
  }
  await audit(v, { action: "run.start", targetType: "job", targetId: job.id, after: settings, ip });
  return dispatch(job, () => send(job.id));
}

// Report from the pipeline. A job only moves forward: a late "running" cannot reopen a finished job.
export async function updateJobFromPipeline(id: string, u: { status: "running" | "done" | "failed"; execution_id?: string | number; result?: unknown; error?: string }) {
  const exec = u.execution_id == null ? null : String(u.execution_id);
  const res = u.status === "running"
    ? await w(`UPDATE web.jobs SET status = 'running', started_at = COALESCE(started_at, now()), n8n_execution_id = COALESCE($2, n8n_execution_id) WHERE id = $1 AND status = 'queued' RETURNING id`, [id, exec])
    : await w(`UPDATE web.jobs SET status = $2, started_at = COALESCE(started_at, now()), finished_at = now(), n8n_execution_id = COALESCE($3, n8n_execution_id), result = COALESCE($4::jsonb, result), error = $5 WHERE id = $1 AND status IN ('queued', 'running') RETURNING id`, [id, u.status, exec, u.result === undefined ? null : JSON.stringify(u.result), u.error ?? null]);
  return res.length > 0;
}

// When a report from the pipeline never arrives: the database says whether the work happened, and a job cannot wait for ever.
const LIMIT_MIN: Record<string, number> = { run: 480, analyse: 240, rescreen: 240, organise: 240, resummarise: 120, forget_run: 30 };

export async function reconcileJobs() {
  const open = await w<JobRow>(`SELECT * FROM web.jobs WHERE status IN ('queued', 'running')`);
  for (const j of open) {
    if (j.type === "analyse") {
      const ids: number[] = j.params?.source_ids ?? [];
      const [r] = await w<{ n: number }>(`SELECT count(*)::int AS n FROM api.source_cards WHERE id = ANY($1::bigint[]) AND extraction_id IS NOT NULL AND analysed_at >= $2`, [ids, j.created_at]);
      if (r.n >= ids.length && ids.length) { await updateJobFromPipeline(j.id, { status: "done", result: { analysed: r.n, by: "database check" } }); continue; }
    }
    if (j.type === "run") {
      const [r] = await w<{ id: string; finished_at: string | null; counts: unknown }>(`SELECT id, finished_at, counts FROM api.run_cards WHERE job_id = $1 ORDER BY id DESC LIMIT 1`, [j.id]);
      if (r?.finished_at) { await updateJobFromPipeline(j.id, { status: "done", result: { run_id: Number(r.id), counts: r.counts, by: "database check" } }); continue; }
    }
    const age = (Date.now() - new Date(j.created_at).getTime()) / 60000;
    if (age > (LIMIT_MIN[j.type] ?? 240)) await failJob(j.id, "No report from the pipeline within the expected time. Check the n8n executions list.");
  }
}

const JOB_SELECT = `SELECT j.*, r.id AS run_id, r.counts AS run_counts FROM web.jobs j LEFT JOIN api.run_cards r ON r.job_id = j.id::text`;

export const listJobs = (opts: { userId?: string; limit?: number }) => opts.userId
  ? w<JobRow>(`${JOB_SELECT} WHERE j.requested_by = $1 ORDER BY j.created_at DESC LIMIT $2`, [opts.userId, opts.limit ?? 100])
  : w<JobRow>(`${JOB_SELECT} ORDER BY j.created_at DESC LIMIT $1`, [opts.limit ?? 200]);

export const getJob = async (id: string) => (await w<JobRow>(`SELECT * FROM web.jobs WHERE id = $1`, [id]))[0];
export const activeRun = async () => (await w<JobRow>(`SELECT * FROM web.jobs WHERE type = 'run' AND status IN ('queued', 'running') LIMIT 1`))[0];
