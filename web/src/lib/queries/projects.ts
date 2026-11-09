import { isExpert, type Viewer } from "@/auth/roles";
import { q, q1 } from "@/db/client";
import { Params, projectWhere, type ProjectFilters } from "@/lib/filters";

export const PAGE_SIZE = 24;
const CARD = `c.id, c.code, c.name, c.db_name, c.summary, c.tool_code, c.tool_name, c.countries, c.tech, c.tech_categories, c.stage, c.evidence_type, c.score, c.flags, c.needs_attention,
  c.domain_tags, c.n_sources, c.n_analysed, c.n_queued, c.n_waiting, c.n_passed, c.n_failed, c.review_state, c.analysed, c.summary_pending, c.reach_number, c.reach_unit, c.reach_is_people, c.has_outcomes, c.has_cost, c.updated_at`;

const SORT: Record<ProjectFilters["sort"], string> = {
  new: "c.updated_at DESC, c.id DESC", old: "c.updated_at ASC, c.id",
  score_hi: "c.score DESC NULLS LAST, c.updated_at DESC", score_lo: "c.score ASC NULLS LAST, c.updated_at DESC",
  evidence: "c.evidence_rank DESC, c.score DESC NULLS LAST", reach: "c.reach_is_people DESC NULLS LAST, c.reach_number DESC NULLS LAST",
  name: "lower(c.name)", country: "c.countries[1] NULLS LAST, c.updated_at DESC",
};

export async function listProjects(f: ProjectFilters, v: Viewer, pageSize = PAGE_SIZE) {
  const p = new Params();
  const where = projectWhere(f, p, { includePending: f.include_pending && isExpert(v) });
  const [total, items] = await Promise.all([
    q1<{ n: number }>(`SELECT count(*)::int AS n FROM api.project_cards c ${where}`, p.values),
    q(`SELECT ${CARD} FROM api.project_cards c ${where} ORDER BY ${SORT[f.sort]} LIMIT ${pageSize} OFFSET ${(f.page - 1) * pageSize}`, p.values),
  ]);
  return { total: total?.n ?? 0, page: f.page, pageSize, items };
}

export async function getProject(code: string, v: Viewer) {
  const project = await q1(`SELECT * FROM api.project_detail WHERE code = $1`, [code]);
  if (!project) return null;
  if (!project.analysed && !isExpert(v)) return null;
  const expert = isExpert(v);
  const [sources, siblings, evidence] = await Promise.all([
    q(`SELECT id, extraction_id, state, headline, title_original, title_en, source_type, language, publisher, published, evidence_type, score, flags, text_level, text_chars, duplicate_of, project_method, project_reason,
              review_decision, reviewer, reviewed_at, pick, url
       FROM api.source_cards WHERE project_id = $1 ${expert ? "" : "AND state = 'analysed'"} ORDER BY id`, [project.id]),
    project.tool_code ? q(`SELECT code, name, countries, stage FROM api.project_cards c WHERE tool_code = $1 AND code <> $2 ${expert ? "" : "AND analysed"} ORDER BY updated_at DESC LIMIT 40`, [project.tool_code, code]) : Promise.resolve([]),
    q(`SELECT id, language, fields->'evidence' AS evidence FROM api.source_detail WHERE project_id = $1 AND state = 'analysed'`, [project.id]),
  ]);
  if (!expert) {
    const open = new Set(sources.map((s) => Number(s.id)));
    if (project.synthesis) project.synthesis = { ...project.synthesis, sources: (project.synthesis.sources ?? []).filter((s: any) => open.has(Number(s.sid))), source_ids: (project.synthesis.source_ids ?? []).filter((id: number) => open.has(Number(id))) };
    for (const s of sources) delete s.reviewer;
    delete project.old_reviewer;
    delete project.old_review_comment;
  }
  return { project, sources, siblings, evidence };
}
