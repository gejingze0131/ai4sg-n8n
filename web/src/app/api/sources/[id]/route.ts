import { isExpert } from "@/auth/roles";
import { HttpError, route } from "@/lib/api";
import { getSource } from "@/lib/queries/sources";

export const GET = route<{ id: string }>({ role: "public" }, async ({ params, viewer }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Bad source id.");
  const r = await getSource(id, viewer);
  if (!r) throw new HttpError(isExpert(viewer) ? 404 : 403, isExpert(viewer) ? "Source not found." : "This source is not open to visitors.");
  return r;
});
