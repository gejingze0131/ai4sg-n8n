import { route } from "@/lib/api";
import { listTools } from "@/lib/queries/misc";

export const GET = route({ role: "public" }, async ({ req, viewer }) => {
  const s = req.nextUrl.searchParams;
  return listTools({ q: s.get("q")?.trim().slice(0, 200) || undefined, page: Math.max(1, Number(s.get("page")) || 1), sort: s.get("sort") ?? undefined }, viewer);
});
