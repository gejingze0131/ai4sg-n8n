import { HttpError, route } from "@/lib/api";
import { projectFilters } from "@/lib/filters";
import { BREAKDOWNS, getBreakdown } from "@/lib/queries/stats";

export const GET = route({ role: "public", query: projectFilters }, async ({ query, req }) => {
  const by = req.nextUrl.searchParams.get("by") ?? "";
  if (!BREAKDOWNS.includes(by)) throw new HttpError(400, `by must be one of ${BREAKDOWNS.join(", ")}`);
  return { by, items: await getBreakdown(query, by) };
});
