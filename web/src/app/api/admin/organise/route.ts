import { route } from "@/lib/api";
import { requestSimple } from "@/lib/jobs";
import { organiseBody } from "@/lib/validators";
import { pipeline } from "@/pipeline";

export const POST = route({ role: "admin", body: organiseBody }, async ({ body, viewer, ip }) => {
  const job = await requestSimple("organise", body, viewer!, ip, (id) => pipeline.organise(id, body.domain, body.max, body.analyse));
  return { ok: true, job_id: job.id };
});
