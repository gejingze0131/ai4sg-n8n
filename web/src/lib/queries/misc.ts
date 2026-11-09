import { isExpert, type Viewer } from "@/auth/roles";
import { q, q1 } from "@/db/client";
import { likePattern, Params } from "@/lib/filters";

export const TOOL_PAGE = 30;

export async function listTools(opts: { q?: string; page: number; sort?: string }, v: Viewer) {
  const p = new Params();
  const w: string[] = isExpert(v) ? [] : ["n_analysed_projects > 0"];
  if (opts.q) w.push(`search_text ILIKE ${p.add(likePattern(opts.q))}`);
  const where = w.length ? `WHERE ${w.join(" AND ")}` : "";
  const order = opts.sort === "name" ? "lower(name)" : "n_analysed_projects DESC, n_projects DESC, lower(name)";
  const [total, items] = await Promise.all([
    q1<{ n: number }>(`SELECT count(*)::int AS n FROM api.tool_cards ${where}`, p.values),
    q(`SELECT code, name, aliases, developer, n_projects::int, n_analysed_projects::int, countries, domain_tags FROM api.tool_cards ${where} ORDER BY ${order} LIMIT ${TOOL_PAGE} OFFSET ${(opts.page - 1) * TOOL_PAGE}`, p.values),
  ]);
  return { total: total?.n ?? 0, page: opts.page, pageSize: TOOL_PAGE, items };
}

export async function getTool(code: string, v: Viewer) {
  const tool = await q1(`SELECT code, name, aliases, developer, n_projects::int, n_analysed_projects::int, countries, domain_tags, id FROM api.tool_cards WHERE code = $1`, [code]);
  if (!tool || (!tool.n_analysed_projects && !isExpert(v))) return null;
  const deployments = await q(`SELECT code, name, summary, countries, stage, evidence_type, score, domain_tags, n_sources, n_analysed, review_state, reach_number, reach_unit, analysed
    FROM api.project_cards WHERE tool_code = $1 ${isExpert(v) ? "" : "AND analysed"} ORDER BY analysed DESC, updated_at DESC`, [code]);
  return { tool, deployments };
}

export const listRuns = () => q(`SELECT id, started_at, finished_at, domain, counts, engine, countries, max_sources, n_tasks::int FROM api.run_cards ORDER BY id DESC LIMIT 200`);

export async function getRun(id: number) {
  const run = await q1(`SELECT * FROM api.run_cards WHERE id = $1`, [id]);
  if (!run) return null;
  const tasks = await q(`SELECT id, created_at, engine, country, language, source_type, candidates, duration_s, commands, web_searches, input_tokens, output_tokens, run_id, queries, error, academic FROM api.search_tasks WHERE pipeline_run = $1 ORDER BY id`, [id]);
  return { run, tasks };
}

// across projects, tools, sources; visitors only find what is analysed
export async function search(text: string, v: Viewer, limit = 6) {
  const t = text.trim();
  if (t.length < 2) return { projects: [], tools: [], sources: [] };
  const like = likePattern(t);
  const expert = isExpert(v);
  const [projects, tools, sources] = await Promise.all([
    q(`SELECT code, name, countries, stage, tool_name, analysed FROM api.project_cards c
       WHERE c.search_text ILIKE $1 ${expert ? "" : "AND c.analysed"}
       ORDER BY (c.code ILIKE $2) DESC, (c.name ILIKE $3) DESC, c.analysed DESC, word_similarity($2, c.name) DESC LIMIT ${limit}`, [like, t, `${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`]),
    q(`SELECT code, name, developer, n_projects::int FROM api.tool_cards c WHERE c.search_text ILIKE $1 ${expert ? "" : "AND c.n_analysed_projects > 0"} ORDER BY word_similarity($2, c.name) DESC, n_projects DESC LIMIT ${limit}`, [like, t]),
    q(`SELECT id, headline, title_original, country, state, source_type FROM api.source_cards s
       WHERE concat_ws(' ', s.headline, s.title_original, s.title_en, s.project_guess, s.doi) ILIKE $1 ${expert ? "" : "AND s.state = 'analysed'"}
       ORDER BY (s.state = 'analysed') DESC, word_similarity($2, s.headline) DESC LIMIT ${limit}`, [like, t]),
  ]);
  return { projects, tools, sources };
}
