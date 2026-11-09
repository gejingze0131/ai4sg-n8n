import { q, q1 } from "@/db/client";
import { Params, projectWhere, type ProjectFilters } from "@/lib/filters";

export async function getStats(f: ProjectFilters) {
  const p = new Params();
  const where = projectWhere(f, p);
  const row = await q1(`
    WITH c AS (SELECT * FROM api.project_cards c ${where})
    SELECT count(*)::int AS projects,
           COALESCE(sum(n_analysed), 0)::int AS analysed_sources,
           COALESCE(sum(n_waiting), 0)::int AS awaiting_review,
           COALESCE(sum(n_passed), 0)::int AS passed,
           COALESCE(sum(n_failed), 0)::int AS failed,
           count(DISTINCT tool_code)::int AS tools,
           count(*) FILTER (WHERE has_outcomes)::int AS with_outcomes,
           count(*) FILTER (WHERE has_cost)::int AS with_cost,
           (SELECT count(DISTINCT x)::int FROM c, unnest(c.countries) x) AS countries,
           (SELECT count(DISTINCT x)::int FROM c, unnest(c.domain_tags) x WHERE x <> 'general') AS domains
    FROM c`, p.values);
  const s = new Params();
  const sw: string[] = [];
  if (f.domain) sw.push(`${s.add(f.domain)} = ANY(domain_tags)`);
  if (f.country) sw.push(`country = ${s.add(f.country)}`);
  const lib = await q1(`SELECT count(*)::int AS total, count(*) FILTER (WHERE state = 'queued')::int AS queued FROM api.source_cards ${sw.length ? `WHERE ${sw.join(" AND ")}` : ""}`, s.values);
  const pending = await q1(`SELECT count(*)::int AS n FROM api.project_cards c WHERE NOT c.analysed`);
  return { ...row, sources_total: lib?.total ?? 0, queued: lib?.queued ?? 0, projects_pending: pending?.n ?? 0 } as Record<string, number>;
}

const BY: Record<string, string> = {
  domain: "unnest(c.domain_tags) AS key",
  country: "unnest(c.countries) AS key",
  tech: "unnest(CASE WHEN cardinality(c.tech_categories) > 0 THEN c.tech_categories ELSE ARRAY['unspecified'] END) AS key",
  stage: "c.stage AS key",
  evidence: "c.evidence_type AS key",
  score: "COALESCE(c.score::text, 'none') AS key",
};
export const BREAKDOWNS = Object.keys(BY);

export async function getBreakdown(f: ProjectFilters, by: string) {
  if (!BY[by]) throw new Error("unknown breakdown");
  const p = new Params();
  return q<{ key: string; n: number }>(`SELECT key, count(*)::int AS n FROM (SELECT ${BY[by]} FROM api.project_cards c ${projectWhere(f, p)}) t GROUP BY key ORDER BY n DESC, key`, p.values);
}

// what the filter menus offer: everything that exists among analysed projects
export async function getFacets() {
  const [countries, techs, runs] = await Promise.all([
    q<{ v: string }>(`SELECT DISTINCT x AS v FROM api.project_cards c, unnest(c.countries) x WHERE c.analysed ORDER BY 1`),
    q<{ v: string }>(`SELECT DISTINCT x AS v FROM api.project_cards c, unnest(c.tech_categories) x WHERE c.analysed ORDER BY 1`),
    q<{ id: string; domain: string; started_at: string }>(`SELECT id, domain, started_at FROM api.run_cards ORDER BY id DESC LIMIT 50`),
  ]);
  return { countries: countries.map((r) => r.v), techs: techs.map((r) => r.v), runs };
}

const STEPS = ["found", "unique", "new", "downloaded", "passed_screen", "analysed"];

export async function getPipelineStats(domain?: string) {
  const p = new Params();
  const where = domain ? `WHERE domain = ${p.add(domain)}` : "";
  const runs = await q(`SELECT id, started_at, finished_at, domain, counts FROM api.run_cards ${where} ORDER BY started_at`, p.values);
  const funnel = STEPS.map((k) => ({ key: k, n: runs.reduce((s, r) => s + (Number(r.counts?.[k]) || 0), 0) }));
  let found = 0, analysed = 0;
  const series = runs.map((r) => {
    found += Number(r.counts?.new) || 0;
    analysed += Number(r.counts?.analysed) || 0;
    return { id: Number(r.id), at: r.started_at as string, domain: r.domain as string | null, found, analysed, newInRun: Number(r.counts?.new) || 0, analysedInRun: Number(r.counts?.analysed) || 0 };
  });
  return { funnel, series };
}
