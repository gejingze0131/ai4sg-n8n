import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { pipeline } from "@/pipeline";

// Stored copies are pages from other sites. Served from this site's address they must not be able to run scripts here: everything
// except a PDF gets a sandbox, which puts it in an origin of its own.
export const GET = route<{ id: string; name: string }>({ role: "expert" }, async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0 || !/^[\w.-]+$/.test(params.name)) throw new HttpError(400, "Bad file name.");
  const upstream = await pipeline.readFile(id, params.name).catch(() => null);
  if (!upstream?.ok || !upstream.body) throw new HttpError(404, "This file is not in the source library (not downloaded, or removed).");
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="source-${id}-${params.name}"` };
  if (!type.includes("application/pdf")) headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src * data:";
  return new NextResponse(upstream.body, { headers });
});
