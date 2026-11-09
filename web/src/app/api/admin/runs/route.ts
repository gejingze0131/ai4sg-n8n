import { route } from "@/lib/api";
import { requestRun } from "@/lib/jobs";
import { runBody } from "@/lib/validators";
import { pipeline } from "@/pipeline";

export const POST = route({ role: "admin", body: runBody }, async ({ body, viewer, ip }) => {
  const job = await requestRun(body, viewer!, ip, (id) => pipeline.startRun(id, body));
  return { ok: true, job_id: job.id };
});
