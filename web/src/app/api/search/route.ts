import { route } from "@/lib/api";
import { search } from "@/lib/queries/misc";

export const GET = route({ role: "public" }, async ({ req, viewer }) => search((req.nextUrl.searchParams.get("q") ?? "").slice(0, 200), viewer, Math.min(20, Number(req.nextUrl.searchParams.get("limit")) || 6)));
