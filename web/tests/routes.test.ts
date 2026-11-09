import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Permissions are checked in one place per route: this test fails when a route forgets to say who may call it.
const API = path.resolve(import.meta.dirname, "../src/app/api");

function routes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routes(p) : e.name === "route.ts" ? [p] : [];
  });
}
const name = (f: string) => path.relative(API, f).replace(/\/route\.ts$/, "");
const all = routes(API);

// not behind a session: the library's own endpoints, and the pipeline's report with the shared key
const OWN_CHECK = new Set(["auth/[...all]", "auth/login", "auth/logout", "internal/jobs/[id]"]);

const EXPECTED: Record<string, Record<string, string>> = {
  "reviews": { POST: "expert" }, "analyse": { POST: "expert" }, "projects/move": { POST: "expert" }, "projects/detach": { POST: "expert" }, "projects/merge": { POST: "expert" },
  "sources/[id]/files/[name]": { GET: "expert" }, "jobs": { GET: "expert" }, "jobs/[id]": { GET: "expert" },
  "runs/[id]": { GET: "admin" }, "admin/runs": { POST: "admin" }, "admin/rescreen": { POST: "admin" }, "admin/organise": { POST: "admin" }, "admin/runs/[id]/forget": { GET: "admin", POST: "admin" },
  "admin/users": { GET: "admin" }, "admin/users/[id]": { PATCH: "admin" }, "admin/audit-log": { GET: "admin" },
};

describe("API routes", () => {
  it("finds the routes", () => expect(all.length).toBeGreaterThan(25));

  it.each(all.filter((f) => !OWN_CHECK.has(name(f))).map((f) => [name(f), f]))("%s declares its role", (_n, f) => {
    const text = fs.readFileSync(f, "utf8");
    const handlers = [...text.matchAll(/export const (GET|POST|PATCH|PUT|DELETE)\b/g)];
    expect(handlers.length).toBeGreaterThan(0);
    for (const h of handlers) expect(text.slice(h.index)).toMatch(/route(<[^(]*>)?\(\{ role: "(public|expert|admin)"/);
    expect(text).not.toMatch(/export (async )?function (GET|POST|PATCH|PUT|DELETE)/);
  });

  it.each(Object.entries(EXPECTED))("%s has the right roles", (n, methods) => {
    const text = fs.readFileSync(path.join(API, n, "route.ts"), "utf8");
    for (const [method, role] of Object.entries(methods)) expect(text).toMatch(new RegExp(`export const ${method} = route(<[^(]*>)?\\(\\{ role: "${role}"`));
  });

  it("every write route except sign-up needs a role", () => {
    for (const f of all.filter((x) => !OWN_CHECK.has(name(x)))) {
      const text = fs.readFileSync(f, "utf8");
      if (name(f) === "auth/register") continue;
      expect(text, name(f)).not.toMatch(/export const (POST|PATCH|PUT|DELETE) = route(<[^(]*>)?\(\{ role: "public"/);
    }
  });

  it("the pipeline's report checks the shared key", () => {
    expect(fs.readFileSync(path.join(API, "internal/jobs/[id]/route.ts"), "utf8")).toMatch(/timingSafeEqual/);
  });
});
