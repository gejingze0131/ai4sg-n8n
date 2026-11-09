import { z } from "zod";

export type RawParams = Record<string, string | string[] | undefined>;

const str = z.string().trim().max(200).optional().catch(undefined).transform((v) => v || undefined);
const flag = z.string().optional().catch(undefined).transform((v) => v === "1" || v === "true");
const pageNo = z.coerce.number().int().min(1).max(100000).catch(1).default(1);

export const projectFilters = z.object({
  q: str, domain: str, country: str, tech: str, stage: str, evidence: str, review: str, source_type: str,
  has_outcomes: flag, has_cost: flag, include_pending: flag,
  run: z.coerce.number().int().positive().optional().catch(undefined),
  sort: z.enum(["new", "old", "score_hi", "score_lo", "evidence", "reach", "name", "country"]).catch("new").default("new"),
  page: pageNo,
});
export type ProjectFilters = z.infer<typeof projectFilters>;

export const sourceFilters = z.object({
  q: str, domain: str, country: str, tech: str, stage: str, evidence: str, source_type: str, language: str, review: str,
  status: z.enum(["analysed", "queued", "duplicate", "filtered", "failed", "not_screened", "judged", "extraction_failed"]).catch("analysed").default("analysed"),
  run: z.coerce.number().int().positive().optional().catch(undefined),
  has_outcomes: flag, has_cost: flag,
  sort: z.enum(["default", "relevance", "new", "score", "domain", "country", "type"]).catch("default").default("default"),
  page: pageNo,
});
export type SourceFilters = z.infer<typeof sourceFilters>;

export const STATUS_TO_STATE: Record<SourceFilters["status"], string> = { analysed: "analysed", queued: "queued", duplicate: "duplicate", filtered: "filtered", failed: "download_failed", not_screened: "not_screened", judged: "judged_out", extraction_failed: "extraction_failed" };

export function flatten(sp: RawParams) {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
export const parseProjects = (sp: RawParams) => projectFilters.parse(flatten(sp));
export const parseSources = (sp: RawParams) => sourceFilters.parse(flatten(sp));

// collects parameters for a query, so that values never go into the SQL text
export class Params {
  values: unknown[] = [];
  add(v: unknown) { this.values.push(v); return `$${this.values.length}`; }
}

export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// The filters shared by api.project_cards and api.map_points.
export function projectWhere(f: ProjectFilters, p: Params, opts: { includePending?: boolean } = {}) {
  const w: string[] = [];
  if (!opts.includePending) w.push("c.analysed");
  if (f.domain) w.push(`${p.add(f.domain)} = ANY(c.domain_tags)`);
  if (f.country) w.push(`${p.add(f.country)} = ANY(c.countries)`);
  if (f.tech) w.push(f.tech === "unspecified" ? "cardinality(c.tech_categories) = 0" : `${p.add(f.tech)} = ANY(c.tech_categories)`);
  if (f.stage) w.push(`c.stage = ${p.add(f.stage)}`);
  if (f.evidence) w.push(`c.evidence_type = ${p.add(f.evidence)}`);
  if (f.review === "attention") w.push("c.needs_attention");
  else if (f.review) w.push(`c.review_state = ${p.add(f.review)}`);
  if (f.has_outcomes) w.push("c.has_outcomes");
  if (f.has_cost) w.push("c.has_cost");
  if (f.source_type) w.push(`${p.add(f.source_type)} = ANY(c.source_types)`);
  if (f.run) w.push(`${p.add(f.run)}::bigint = ANY(c.run_ids)`);
  if (f.q) w.push(`c.search_text ILIKE ${p.add(likePattern(f.q))}`);
  return w.length ? `WHERE ${w.join(" AND ")}` : "";
}

export function projectQuery(f: Partial<ProjectFilters>, drop: string[] = ["page"]) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (drop.includes(k) || v === undefined || v === null || v === "" || v === false) continue;
    if (k === "sort" && v === "new") continue;
    if (k === "page" && v === 1) continue;
    s.set(k, v === true ? "1" : String(v));
  }
  return s.toString();
}
