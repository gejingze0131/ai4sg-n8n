import { HttpError, route } from "@/lib/api";
import { getProject } from "@/lib/queries/projects";

export const GET = route<{ code: string }>({ role: "public" }, async ({ params, viewer }) => {
  const r = await getProject(params.code.toUpperCase(), viewer);
  if (!r) throw new HttpError(404, "Project not found.");
  const { search_text: _omit, ...project } = r.project;
  return { ...r, project };
});
