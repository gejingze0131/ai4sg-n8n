import { isExpert, type Viewer } from "@/auth/roles";
import { q, q1 } from "@/db/client";
import { likePattern, Params, STATUS_TO_STATE, type SourceFilters } from "@/lib/filters";

export const SOURCE_PAGE = 30;

const SORT: Record<string, string> = {
  relevance: "s.screen_relevance DESC NULLS LAST, s.created_at DESC", new: "s.created_at DESC, s.id DESC", score: "s.score DESC NULLS LAST, s.created_at DESC",
  domain: "s.domain_tags[1], s.screen_relevance DESC NULLS LAST", country: "s.country, s.screen_relevance DESC NULLS LAST", type: "s.source_type, s.screen_relevance DESC NULLS LAST",
};

// visitors only ever get analysed sources; the routes and pages check this too before calling
export async function listSources(f: SourceFilters, pageSize = SOURCE_PAGE) {
  const p = new Params();
  const w = [`s.state = ${p.add(STATUS_TO_STATE[f.status])}`];
  if (f.domain) w.push(`${p.add(f.domain)} = ANY(s.domain_tags)`);
  if (f.country) w.push(`s.country = ${p.add(f.country)}`);
  if (f.tech) w.push(`s.tech_category = ${p.add(f.tech)}`);
  if (f.stage) w.push(`s.stage = ${p.add(f.stage)}`);
  if (f.evidence) w.push(`s.evidence_type = ${p.add(f.evidence)}`);
  if (f.source_type) w.push(`s.source_type = ${p.add(f.source_type)}`);
  if (f.language) w.push(`s.language = ${p.add(f.language)}`);
  if (f.run) w.push(`s.run_id = ${p.add(f.run)}`);
  if (f.has_outcomes) w.push("s.has_outcomes");
  if (f.has_cost) w.push("s.has_cost");
  if (f.review === "awaiting") w.push("s.review_decision IS NULL");
  else if (f.review === "passed") w.push("s.review_decision = 'approved'");
  else if (f.review === "failed") w.push("s.review_decision = 'rejected'");
  else if (f.review === "attention") w.push("jsonb_array_length(s.flags) > 0");
  if (f.q) w.push(`concat_ws(' ', s.headline, s.title_original, s.title_en, s.project_guess, s.project_name, s.country, s.url, s.doi) ILIKE ${p.add(likePattern(f.q))}`);
  const where = `WHERE ${w.join(" AND ")}`;
  const defaultSort = ["queued", "filtered"].includes(f.status) ? SORT.relevance : SORT.new;
  const order = f.sort === "default" ? defaultSort : SORT[f.sort];
  const [total, items] = await Promise.all([
    q1<{ n: number }>(`SELECT count(*)::int AS n FROM api.source_cards s ${where}`, p.values),
    q(`SELECT s.id, s.state, s.headline, s.title_original, s.title_en, s.url, s.country, s.language, s.source_type, s.domain_tags, s.run_id, s.score, s.screen_relevance, s.evidence_type, s.flags,
              s.text_level, s.text_chars, s.duplicate_of, s.project_code, s.project_name, s.project_guess, s.review_decision, s.created_at, s.pick, s.screen, s.cascaded, s.summary, s.raw_status, s.stage
       FROM api.source_cards s
       ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(f.page - 1) * pageSize}`, p.values),
  ]);
  return { total: total?.n ?? 0, page: f.page, pageSize, items };
}

export async function stateCounts(domain?: string) {
  const p = new Params();
  const rows = await q<{ state: string; n: number }>(`SELECT state, count(*)::int AS n FROM api.source_cards ${domain ? `WHERE ${p.add(domain)} = ANY(domain_tags)` : ""} GROUP BY state`, p.values);
  return Object.fromEntries(rows.map((r) => [r.state, r.n])) as Record<string, number>;
}

export async function getSource(id: number, v: Viewer) {
  const source = await q1(`SELECT * FROM api.source_detail WHERE id = $1`, [id]);
  if (!source) return null;
  if (source.state !== "analysed" && !isExpert(v)) return null;
  const expert = isExpert(v);
  delete source.reviewer_id;
  if (!expert) { delete source.reviewer; delete source.review_comment; }
  const [others, project] = await Promise.all([
    source.project_id ? q(`SELECT id, headline, state FROM api.source_cards WHERE project_id = $1 AND id <> $2 ${expert ? "" : "AND state = 'analysed'"} ORDER BY id LIMIT 50`, [source.project_id, id]) : Promise.resolve([]),
    source.project_id ? q1(`SELECT code, name, n_sources, tool_code, tool_name, analysed FROM api.project_cards WHERE id = $1`, [source.project_id]) : Promise.resolve(undefined),
  ]);
  const dup = source.duplicate_of ? await q1(`SELECT id, headline FROM api.source_cards WHERE id = $1`, [source.duplicate_of]) : undefined;
  return { source, others, project, dup };
}
