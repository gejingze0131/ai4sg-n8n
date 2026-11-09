import { HttpError, route } from "@/lib/api";
import { getTool } from "@/lib/queries/misc";

export const GET = route<{ code: string }>({ role: "public" }, async ({ params, viewer }) => {
  const r = await getTool(params.code.toUpperCase(), viewer);
  if (!r) throw new HttpError(404, "Tool not found.");
  return r;
});
