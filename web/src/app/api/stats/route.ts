import { route } from "@/lib/api";
import { projectFilters } from "@/lib/filters";
import { getPipelineStats, getStats } from "@/lib/queries/stats";

export const GET = route({ role: "public", query: projectFilters }, async ({ query }) => ({ stats: await getStats(query), pipeline: await getPipelineStats(query.domain) }));
