import { route } from "@/lib/api";

export const GET = route({ role: "public" }, async ({ viewer }) => ({ user: viewer, role: viewer?.role ?? "visitor" }));
