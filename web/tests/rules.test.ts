import { describe, expect, it } from "vitest";
import { atLeast, effectiveRole, type Viewer } from "@/auth/roles";
import { analyseBody, mergeBody, reviewBody, runBody, userPatchBody } from "@/lib/validators";

const viewer = (role: "visitor" | "expert" | "admin"): Viewer => ({ id: "1", name: "A", email: "a@b.c", role, requestedRole: role, approved: true });

describe("roles", () => {
  it("orders the roles", () => {
    expect(atLeast(null, "expert")).toBe(false);
    expect(atLeast(viewer("visitor"), "expert")).toBe(false);
    expect(atLeast(viewer("expert"), "expert")).toBe(true);
    expect(atLeast(viewer("expert"), "admin")).toBe(false);
    expect(atLeast(viewer("admin"), "expert")).toBe(true);
  });
  it("keeps an expert who waits for approval a visitor", () => {
    expect(effectiveRole({ role: "expert", approved: false })).toBe("visitor");
    expect(effectiveRole({ role: "expert", approved: true })).toBe("expert");
    expect(effectiveRole({ role: "something else" })).toBe("visitor");
    expect(effectiveRole(null)).toBe("visitor");
  });
});

describe("request bodies", () => {
  const run = { domain: "education", countries: ["India"], languages: ["en"], source_types: ["news"], engine: "api", max_searches: 1, results_per_search: 5, screen_level: "balanced" };
  it("allows at most 30 sources per analysis", () => {
    expect(analyseBody.safeParse({ source_ids: Array.from({ length: 30 }, (_, i) => i + 1) }).success).toBe(true);
    expect(analyseBody.safeParse({ source_ids: Array.from({ length: 31 }, (_, i) => i + 1) }).success).toBe(false);
    expect(analyseBody.safeParse({ source_ids: [] }).success).toBe(false);
  });
  it("accepts only pass or fail", () => expect(reviewBody.safeParse({ source_id: 1, decision: "maybe" }).success).toBe(false));
  it("refuses merging a project into itself", () => expect(mergeBody.safeParse({ project: "P-00001", target: "p-00001" }).success).toBe(false));
  it("needs a country for a run", () => {
    expect(runBody.safeParse(run).success).toBe(true);
    expect(runBody.safeParse({ ...run, countries: [] }).success).toBe(false);
    expect(runBody.safeParse({ ...run, countries: [], other_countries: "Nepal" }).success).toBe(true);
    expect(runBody.safeParse({ ...run, domain: "space" }).success).toBe(false);
  });
  it("needs something to change on a user", () => expect(userPatchBody.safeParse({}).success).toBe(false));
});
