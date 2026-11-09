import { q1 } from "@/db/client";
import { route } from "@/lib/api";

export const GET = route({ role: "public" }, async () => {
  await q1("SELECT 1 FROM api.run_cards LIMIT 1");
  return { ok: true };
});
