import { route } from "@/lib/api";
import { projectFilters } from "@/lib/filters";
import { listProjects } from "@/lib/queries/projects";

export const GET = route({ role: "public", query: projectFilters }, async ({ query, viewer }) => listProjects(query, viewer));
