import { isExpert } from "@/auth/roles";
import { HttpError, route } from "@/lib/api";
import { sourceFilters } from "@/lib/filters";
import { listSources } from "@/lib/queries/sources";

export const GET = route({ role: "public", query: sourceFilters }, async ({ query, viewer }) => {
  if (query.status !== "analysed" && !isExpert(viewer)) throw new HttpError(403, "Only experts can see sources that have not been analysed.");
  return listSources(query);
});
