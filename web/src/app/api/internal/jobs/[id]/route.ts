import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, HttpError } from "@/lib/api";
import { env } from "@/lib/env";
import { getJob, updateJobFromPipeline } from "@/lib/jobs";
import { internalJobBody } from "@/lib/validators";
import { SECRET_HEADER } from "@/pipeline/n8n";

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const UUID = /^[0-9a-f-]{36}$/i;

// internal: only n8n calls this, with the shared key (not a session), to report how a job went
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!same(req.headers.get(SECRET_HEADER) ?? "", env.n8nSecret)) throw new HttpError(403, "Bad key.");
    const { id } = await ctx.params;
    if (!UUID.test(id) || !(await getJob(id))) throw new HttpError(404, "No such job.");
    const parsed = internalJobBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Bad report.");
    return NextResponse.json({ ok: true, changed: await updateJobFromPipeline(id, parsed.data) });
  } catch (e) {
    return errorResponse(e);
  }
}
