import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { allowedHosts } from "@/auth/auth";
import { atLeast, type Role, type Viewer } from "@/auth/roles";
import { viewerFrom } from "@/auth/session";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Ctx<B, Q, P> = { req: NextRequest; viewer: Viewer; body: B; query: Q; params: P; ip: string };
type Opts<B, Q> = { role: "public" | Exclude<Role, "visitor">; body?: z.ZodType<B>; query?: z.ZodType<Q> };

export const clientIp = (req: NextRequest) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();

// Every /api route declares the role it needs here. (tests/routes.test.ts fails if a route does not.)
export function route<P = Record<string, string>, B = unknown, Q = unknown>(opts: Opts<B, Q>, handler: (c: Ctx<B, Q, P>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req);
      const viewer = await viewerFrom(req.headers);
      if (opts.role !== "public" && !atLeast(viewer, opts.role)) throw new HttpError(403, viewer ? "You do not have permission to do this." : "Please sign in with an account that has permission to do this.");
      const query = opts.query ? parse(opts.query, Object.fromEntries(req.nextUrl.searchParams)) : (undefined as Q);
      let body = undefined as B;
      if (opts.body) {
        const raw = await req.json().catch(() => { throw new HttpError(400, "The request body is not valid JSON."); });
        body = parse(opts.body, raw);
      }
      const out = await handler({ req, viewer, body, query, params: await ctx.params, ip: clientIp(req) });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const first = r.error.issues[0];
  throw new HttpError(400, `${first.path.join(".") || "request"}: ${first.message}`);
}

// a state-changing request has to come from this site's own pages
function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  let host = "";
  try { host = new URL(origin).host; } catch { /* fall through */ }
  if (!allowedHosts().includes(host)) throw new HttpError(403, "This request did not come from this site.");
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  const code = (e as { code?: string })?.code;
  const message = (e as Error)?.message ?? "error";
  if (code === "P0002") return NextResponse.json({ ok: false, error: message }, { status: 404 });
  if (code === "22023") return NextResponse.json({ ok: false, error: message }, { status: 400 });
  console.error("[api]", e);
  return NextResponse.json({ ok: false, error: "Something went wrong on the server." }, { status: 500 });
}
