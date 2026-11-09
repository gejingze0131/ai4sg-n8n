import { env } from "@/lib/env";
import type { PipelineAdapter, RunSettings } from "./adapter";

export const SECRET_HEADER = "x-ai4sg-key";

async function post(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${env.n8nUrl}/webhook/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", [SECRET_HEADER]: env.n8nSecret },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`The pipeline could not be reached (${(e as Error).message}).`);
  }
  if (!res.ok) throw new Error(`The pipeline refused the request (HTTP ${res.status}).`);
}

export const n8nAdapter: PipelineAdapter = {
  startRun: (job_id, s: RunSettings) => post("ai4sg-run-start", { ...s, job_id }),
  analyse: (job_id, source_ids, reviewer) => post("ai4sg-analyse", { source_ids, reviewer, job_id }),
  rescreen: (job_id, domain, limit, min_relevance) => post("ai4sg-rescreen", { domain, limit, min_relevance, job_id }),
  organise: (job_id, domain, max, analyse) => post("ai4sg-select", { domain, max, analyse, job_id }),
  resummarise: (job_id, project_ids) => post("ai4sg-resummarise", { project_ids, job_id }),
  async forgetRun(_jobId, runId, sourceIds) {
    const res = await fetch(`${env.codexRunnerUrl}/library-archive`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: runId, source_ids: sourceIds }), signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`The source library could not be archived (HTTP ${res.status}).`);
    const out = (await res.json()) as { moved?: number };
    return { moved: out.moved ?? 0 };
  },
  readFile(sourceId, name) {
    const safe = name === "text" ? "text" : `file/${name.replace(/[^\w.-]/g, "")}`;
    return fetch(`${env.codexRunnerUrl}/library/${sourceId}/${safe}`, { signal: AbortSignal.timeout(60000) });
  },
};
