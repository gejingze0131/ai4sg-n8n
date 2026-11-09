import { describe, expect, it } from "vitest";
import { likePattern, Params, parseProjects, parseSources, projectQuery, projectWhere } from "@/lib/filters";

describe("filters", () => {
  it("sends values as parameters, never in the SQL", () => {
    const p = new Params();
    const evil = "x'; DROP TABLE sources; --";
    const sql = projectWhere(parseProjects({ domain: evil, country: evil, q: evil, stage: evil }), p);
    expect(sql).not.toContain("DROP");
    expect(p.values).toContain(evil);
  });
  it("escapes the wildcards in a search", () => expect(likePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%"));
  it("shows only analysed projects unless asked", () => {
    expect(projectWhere(parseProjects({}), new Params())).toContain("c.analysed");
    expect(projectWhere(parseProjects({}), new Params(), { includePending: true })).toBe("");
  });
  it("ignores nonsense in the URL", () => {
    const f = parseProjects({ page: "abc", sort: "nope", run: "x", has_outcomes: "maybe" });
    expect(f).toMatchObject({ page: 1, sort: "new", run: undefined, has_outcomes: false });
    expect(parseSources({ status: "secret" }).status).toBe("analysed");
  });
  it("writes the filters back into a URL", () => {
    expect(projectQuery(parseProjects({ domain: "education", has_cost: "1", page: "3" }))).toBe("domain=education&has_cost=1");
  });
});
