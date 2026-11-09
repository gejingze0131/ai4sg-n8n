import { isAdmin } from "@/auth/roles";
import { HttpError, route } from "@/lib/api";
import { getJob, reconcileJobs } from "@/lib/jobs";

const UUID = /^[0-9a-f-]{36}$/i;

export const GET = route<{ id: string }>({ role: "expert" }, async ({ params, viewer }) => {
  if (!UUID.test(params.id)) throw new HttpError(404, "Job not found.");
  await reconcileJobs();
  const job = await getJob(params.id);
  if (!job || (!isAdmin(viewer) && job.requested_by !== viewer!.id)) throw new HttpError(404, "Job not found.");
  return job;
});
