import { HttpError, route } from "@/lib/api";
import { getRun } from "@/lib/queries/misc";

export const GET = route<{ id: string }>({ role: "admin" }, async ({ params }) => {
  const r = await getRun(Number(params.id));
  if (!r) throw new HttpError(404, "Run not found.");
  return r;
});
