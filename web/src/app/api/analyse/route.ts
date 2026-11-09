import { route } from "@/lib/api";
import { requestAnalysis } from "@/lib/jobs";
import { analyseBody } from "@/lib/validators";

export const POST = route({ role: "expert", body: analyseBody }, async ({ body, viewer, ip }) => {
  const { job, sent, skipped } = await requestAnalysis(body.source_ids, viewer!, ip);
  return { ok: true, job_id: job.id, sources: sent.length, skipped };
});
