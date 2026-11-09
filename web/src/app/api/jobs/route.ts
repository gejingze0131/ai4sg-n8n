import { isAdmin } from "@/auth/roles";
import { route } from "@/lib/api";
import { listJobs, reconcileJobs } from "@/lib/jobs";

export const GET = route({ role: "expert" }, async ({ req, viewer }) => {
  await reconcileJobs();
  const mine = req.nextUrl.searchParams.get("mine") === "1" || !isAdmin(viewer);
  return { items: await listJobs(mine ? { userId: viewer!.id } : {}) };
});
