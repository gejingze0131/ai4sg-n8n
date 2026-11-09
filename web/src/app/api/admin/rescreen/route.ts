import { route } from "@/lib/api";
import { requestSimple } from "@/lib/jobs";
import { rescreenBody } from "@/lib/validators";
import { pipeline } from "@/pipeline";

export const POST = route({ role: "admin", body: rescreenBody }, async ({ body, viewer, ip }) => {
  const job = await requestSimple("rescreen", body, viewer!, ip, (id) => pipeline.rescreen(id, body.domain, body.limit, body.min_relevance));
  return { ok: true, job_id: job.id };
});
