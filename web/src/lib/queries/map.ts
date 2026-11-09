import { q } from "@/db/client";
import { Params, projectWhere, type ProjectFilters } from "@/lib/filters";

// Below this zoom the map shows one mark per province or state.
export const POINT_ZOOM = 5.5;
const MAX_ITEMS = 5000;

export async function getMap(f: ProjectFilters, zoom: number) {
  const p = new Params();
  const where = projectWhere(f, p);
  const active = f.domain ? p.add(f.domain) : "NULL::text";
  const dom = `COALESCE(${active}, c.domain_tags[1])`;
  if (zoom >= POINT_ZOOM) {
    const items = await q(`
      SELECT c.code, c.name, c.tool_name, c.place, c.level, c.admin1, c.country, c.lat, c.lon, c.stage, c.evidence_type, c.domain_tags,
             c.reach_number, c.reach_unit, c.reach_is_people, c.reach_is_target, ${dom} AS domain
      FROM api.map_points c ${where} ORDER BY c.reach_number DESC NULLS LAST, c.code LIMIT ${MAX_ITEMS}`, p.values);
    return { mode: "point" as const, items };
  }
  const items = await q(`
    WITH c AS (SELECT c.*, ${dom} AS domain FROM api.map_points c ${where}),
    g AS (
      SELECT country, admin1, avg(lat) AS lat, avg(lon) AS lon, count(*)::int AS n_points, count(DISTINCT code)::int AS n_projects
      FROM c GROUP BY country, admin1
    )
    SELECT g.*,
      (SELECT domain FROM c WHERE c.country = g.country AND c.admin1 = g.admin1 GROUP BY domain ORDER BY count(*) DESC, domain LIMIT 1) AS domain,
      (SELECT sum(r)::float8 FROM (SELECT max(c.reach_number) AS r FROM c WHERE c.country = g.country AND c.admin1 = g.admin1 AND c.reach_is_people GROUP BY c.code) x) AS reach_people,
      (SELECT jsonb_object_agg(d, n) FROM (SELECT domain AS d, count(DISTINCT code) AS n FROM c WHERE c.country = g.country AND c.admin1 = g.admin1 GROUP BY domain) x) AS domains,
      (SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name)) FROM (SELECT DISTINCT ON (code) code, name, reach_number FROM c WHERE c.country = g.country AND c.admin1 = g.admin1 ORDER BY code) t) AS projects
    FROM g ORDER BY n_projects DESC LIMIT ${MAX_ITEMS}`, p.values);
  return { mode: "cluster" as const, items: items.map((r) => ({ ...r, projects: (r.projects || []).slice(0, 6) })) };
}
