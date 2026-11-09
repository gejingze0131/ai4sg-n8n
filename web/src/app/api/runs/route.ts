import { route } from "@/lib/api";
import { listRuns } from "@/lib/queries/misc";

export const GET = route({ role: "public" }, async () => ({ items: await listRuns() }));
