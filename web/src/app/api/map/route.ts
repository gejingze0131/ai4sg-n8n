import { route } from "@/lib/api";
import { projectFilters } from "@/lib/filters";
import { getMap } from "@/lib/queries/map";

export const GET = route({ role: "public", query: projectFilters }, async ({ query, req }) => getMap(query, Number(req.nextUrl.searchParams.get("zoom")) || 0));
