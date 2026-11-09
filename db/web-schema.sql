-- What the website (web/) needs from the database. Idempotent; setup.sh applies it as the database superuser, after
-- pipeline-schema.sql, and once more after the website has created its own tables.
--   psql -v ro_pw=... -v rw_pw=... -f db/web-schema.sql
-- Two login roles:
--   web_ro  reads the views in schema "api" and nothing else
--   web_rw  owns schema "web" (users, sessions, jobs, audit log; created by the website's migrations) and may run the
--           ai4sg_* functions, the only way the website changes the pipeline's tables
-- The pipeline's tables (schema public) stay as they are. When they change, only these views need to follow.
\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT 'CREATE ROLE web_ro LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_ro') \gexec
SELECT 'CREATE ROLE web_rw LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_rw') \gexec
ALTER ROLE web_ro WITH LOGIN PASSWORD :'ro_pw';
ALTER ROLE web_rw WITH LOGIN PASSWORD :'rw_pw';

CREATE SCHEMA IF NOT EXISTS web AUTHORIZATION web_rw;
-- (the migration tool always issues CREATE SCHEMA IF NOT EXISTS, which needs this even when the schema exists)
SELECT format('GRANT CREATE ON DATABASE %I TO web_rw', current_database()) \gexec
CREATE SCHEMA IF NOT EXISTS api;

BEGIN;
DROP VIEW IF EXISTS api.map_points, api.tool_cards, api.project_detail, api.project_cards, api.source_detail, api.source_cards, api.run_cards, api.search_tasks CASCADE;

-- a JSON array as text[] (anything else: empty)
CREATE OR REPLACE FUNCTION api.text_array(j JSONB) RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(x), '{}') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(j) = 'array' THEN j ELSE '[]'::jsonb END) x WHERE x <> ''
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- What a reach figure counts, read from its free-text unit: the first keyword decides ("students in 40 schools" counts people,
-- "cases reported, not unique residents" does not). people | organisations | other
CREATE OR REPLACE FUNCTION api.reach_class(unit TEXT) RETURNS TEXT AS $$
  WITH u AS (SELECT lower(COALESCE(unit, '')) AS t),
  m AS (
    SELECT regexp_instr(t, '\m(people|persons?|individuals?|residents?|citizens?|patients?|farmers?|fishers?|students?|learners?|pupils?|children|infants?|teachers?|users?|participants?|beneficiar(y|ies)|members?|testers?|mothers?|women|men|workers?|households?|families|respondents?)\M') AS person,
           regexp_instr(t, '\m(schools?|organi[sz]ations?|offices?|agenc(y|ies)|institutions?|hospitals?|clinics?|facilit(y|ies)|companies|villages?|districts?)\M') AS org,
           regexp_instr(t, '\m(cases?|tickets?|reports?|ponds?|plots?|fields?|farms?|sites?|devices?|messages?|images?|scans?|x-rays?|records?|sessions?|calls?|queries)\M') AS thing
    FROM u)
  SELECT CASE
    WHEN person > 0 AND (org = 0 OR person < org) AND (thing = 0 OR person < thing) THEN 'people'
    WHEN org > 0 AND (thing = 0 OR org < thing) THEN 'organisations'
    ELSE 'other' END FROM m
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- One row per source, with its latest analysis. state:
--   analysed            analysed and judged AI4SG (what visitors can see)
--   judged_out          analysed, judged not AI4SG
--   extraction_failed   the analysis produced no structured result
--   queued              passed the screen, waiting for analysis
--   duplicate           the same document as another source
--   filtered            set aside by the screen
--   download_failed     no readable text
--   not_screened        found or downloaded, the run stopped before the screen
CREATE VIEW api.source_cards AS
SELECT
  s.id, e.id AS extraction_id,
  CASE
    WHEN e.id IS NOT NULL AND (e.fields IS NULL OR e.flags ? 'extraction_failed') THEN 'extraction_failed'
    WHEN e.id IS NOT NULL AND (e.status = 'filtered_out' OR e.fields->>'is_ai4sg' = 'false') THEN 'judged_out'
    WHEN e.id IS NOT NULL THEN 'analysed'
    WHEN s.status = 'passed' THEN 'queued'
    WHEN s.status = 'duplicate' THEN 'duplicate'
    WHEN s.status = 'filtered_out' THEN 'filtered'
    WHEN s.status = 'collect_failed' THEN 'download_failed'
    ELSE 'not_screened'
  END AS state,
  s.url, s.doi, s.database, s.source_type, s.format, s.search_engine,
  COALESCE(NULLIF(e.fields->>'headline', ''), NULLIF(e.fields->'project'->>'name', ''), NULLIF(s.screen->>'headline_en', ''), NULLIF(s.title_en, ''), NULLIF(s.title, ''), s.url) AS headline,
  COALESCE(NULLIF(e.fields->'source'->>'title_original', ''), s.title, '') AS title_original,
  COALESCE(NULLIF(e.fields->'source'->>'title_en', ''), s.title_en, '') AS title_en,
  COALESCE(e.fields->'source'->>'publisher', '') AS publisher,
  COALESCE(e.fields->'source'->>'published', '') AS published,
  COALESCE(NULLIF(e.fields->'source'->>'summary_en', ''), s.why_relevant, '') AS summary,
  COALESCE(NULLIF(e.fields->'project'->'countries'->>0, ''), s.country, '') AS country,
  COALESCE(NULLIF(e.fields->'source'->>'language', ''), s.language, '') AS language,
  s.domain AS run_domain,
  CASE WHEN cardinality(array_remove(s.domain_tags, '')) > 0 THEN array_remove(s.domain_tags, '') ELSE ARRAY[COALESCE(NULLIF(s.domain, ''), 'general')] END AS domain_tags,
  s.run_id,
  COALESCE(NULLIF(e.fields->'technology'->>'category', ''), 'unspecified') AS tech_category,
  COALESCE(NULLIF(e.fields->'project'->>'deployment_stage', ''), 'unknown') AS stage,
  COALESCE(NULLIF(e.fields->'evidence_strength'->>'type', ''), 'none') AS evidence_type,
  e.relevance_score AS score,
  COALESCE(s.screen_relevance, e.confidence) AS screen_relevance,
  EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.fields->'outcomes') = 'array' THEN e.fields->'outcomes' ELSE '[]'::jsonb END) o WHERE o->>'value' IS NOT NULL AND o->>'value' <> '') AS has_outcomes,
  COALESCE((e.fields->'cost'->>'stated')::boolean, false) OR COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(e.fields->'cost'->'breakdown') = 'array' THEN e.fields->'cost'->'breakdown' END), 0) > 0 AS has_cost,
  COALESCE(e.flags, '[]'::jsonb) AS flags,
  s.text_level, s.text_chars, s.duplicate_of, s.project_guess, s.status AS raw_status, s.found_via IS NOT NULL AS cascaded,
  sp.project_id, p.code AS project_code, COALESCE(NULLIF(p.synthesis->'llm'->>'name', ''), p.name) AS project_name, sp.method AS project_method, sp.reason AS project_reason,
  t.code AS tool_code, t.name AS tool_name,
  rv.decision AS review_decision, rv.comment AS review_comment, rv.reviewer, rv.reviewer_id, rv.created_at AS reviewed_at,
  COALESCE(e.created_at, s.created_at) AS created_at,
  s.created_at AS found_at, e.created_at AS analysed_at,
  s.pick, s.screen
FROM sources s
LEFT JOIN LATERAL (SELECT x.* FROM extractions x WHERE x.source_id = s.id ORDER BY x.created_at DESC, x.id DESC LIMIT 1) e ON true
LEFT JOIN source_projects sp ON sp.source_id = s.id
LEFT JOIN ai_projects p ON p.id = sp.project_id
LEFT JOIN ai_tools t ON t.id = p.tool_id
LEFT JOIN LATERAL (SELECT r.decision, r.comment, r.reviewer, r.reviewer_id, r.created_at FROM reviews r WHERE r.extraction_id = e.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) rv ON true
WHERE e.id IS NOT NULL OR s.status IS NOT NULL;

-- the full record of one source
CREATE VIEW api.source_detail AS
SELECT c.*, e.fields, e.confidence, s.files, s.why_relevant, s.relation, s.found_via, s.found_via_url, s.collected_at,
       par.title AS via_title, par.url AS via_url
FROM api.source_cards c
JOIN sources s ON s.id = c.id
LEFT JOIN extractions e ON e.id = c.extraction_id
LEFT JOIN sources par ON par.id = s.found_via;

-- One row per deployment (project), with what its sources add up to.
CREATE VIEW api.project_cards AS
WITH src AS (
  SELECT c.project_id,
    count(*) AS n_sources,
    count(*) FILTER (WHERE c.state = 'analysed') AS n_analysed,
    count(*) FILTER (WHERE c.state = 'queued') AS n_queued,
    count(*) FILTER (WHERE c.state = 'analysed' AND c.review_decision IS NULL) AS n_waiting,
    count(*) FILTER (WHERE c.state = 'analysed' AND c.review_decision = 'approved') AS n_passed,
    count(*) FILTER (WHERE c.state = 'analysed' AND c.review_decision = 'rejected') AS n_failed,
    max(c.score) FILTER (WHERE c.state = 'analysed') AS best_score,
    (SELECT COALESCE(array_agg(DISTINCT x), '{}') FROM unnest(array_agg(c.source_type)) x WHERE x IS NOT NULL) AS source_types,
    (SELECT COALESCE(array_agg(DISTINCT x), '{}') FROM unnest(array_agg(c.run_id)) x WHERE x IS NOT NULL) AS run_ids,
    string_agg(concat_ws(' ', c.headline, c.title_original, c.title_en), ' ') AS source_text
  FROM api.source_cards c WHERE c.project_id IS NOT NULL GROUP BY c.project_id
), tags AS (
  SELECT sp.project_id, array_agg(DISTINCT tg ORDER BY tg) AS tags
  FROM source_projects sp JOIN api.source_cards c ON c.id = sp.source_id, unnest(c.domain_tags) tg GROUP BY sp.project_id
)
SELECT
  p.id, p.code,
  COALESCE(NULLIF(p.synthesis->'llm'->>'name', ''), p.name) AS name, p.name AS db_name, p.aliases, p.implementing_org, p.deployment, p.synthesis IS NULL AS summary_pending,
  t.id AS tool_id, t.code AS tool_code, t.name AS tool_name, t.developer AS tool_developer,
  CASE WHEN cardinality(api.text_array(p.synthesis->'countries')) > 0 THEN api.text_array(p.synthesis->'countries') ELSE api.text_array(p.countries) END AS countries,
  api.text_array(p.synthesis->'tech_categories') AS tech_categories,
  COALESCE((api.text_array(p.synthesis->'tech_categories'))[1], 'unspecified') AS tech,
  COALESCE(NULLIF(p.synthesis->>'stage', ''), 'unknown') AS stage,
  COALESCE(NULLIF(p.synthesis->'evidence_best'->>'type', ''), 'none') AS evidence_type,
  CASE COALESCE(p.synthesis->'evidence_best'->>'type', 'none') WHEN 'rct' THEN 5 WHEN 'quasi_experimental' THEN 4 WHEN 'observational' THEN 3 WHEN 'pilot_report' THEN 2 WHEN 'anecdotal' THEN 1 ELSE 0 END AS evidence_rank,
  (p.synthesis->>'score_best')::int AS score,
  COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(CASE WHEN jsonb_typeof(p.synthesis->'flags') = 'object' THEN p.synthesis->'flags' ELSE '{}'::jsonb END) k), '{}') AS flags,
  EXISTS (SELECT 1 FROM jsonb_object_keys(CASE WHEN jsonb_typeof(p.synthesis->'flags') = 'object' THEN p.synthesis->'flags' ELSE '{}'::jsonb END) k
          WHERE k IN ('quote_not_found', 'cost_without_evidence', 'benefit_without_evidence', 'extraction_failed', 'outcome_without_evidence')) AS needs_attention,
  EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.synthesis->'outcomes') = 'array' THEN p.synthesis->'outcomes' ELSE '[]'::jsonb END) o WHERE o->>'value' IS NOT NULL AND o->>'value' <> '') AS has_outcomes,
  COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.synthesis->'cost') = 'array' THEN p.synthesis->'cost' END), 0) > 0 AS has_cost,
  rp.number AS reach_number, rp.unit AS reach_unit, rp.is_target AS reach_is_target, rp.people AS reach_is_people,
  left(regexp_replace(COALESCE(p.synthesis->'llm'->>'summary', p.summary, ''), '\s?\[S\d+\]', '', 'g'), 420) AS summary,
  COALESCE(tg.tags, ARRAY['general']) AS domain_tags,
  COALESCE(src.source_types, '{}') AS source_types, COALESCE(src.run_ids, '{}') AS run_ids,
  COALESCE(src.n_sources, 0) AS n_sources, COALESCE(src.n_analysed, 0) AS n_analysed, COALESCE(src.n_queued, 0) AS n_queued,
  COALESCE(src.n_waiting, 0) AS n_waiting, COALESCE(src.n_passed, 0) AS n_passed, COALESCE(src.n_failed, 0) AS n_failed,
  COALESCE(src.n_analysed, 0) > 0 AS analysed,
  CASE WHEN COALESCE(src.n_analysed, 0) = 0 THEN 'none' WHEN src.n_waiting > 0 THEN 'awaiting' WHEN src.n_failed > 0 THEN 'failed' ELSE 'passed' END AS review_state,
  p.created_at, p.updated_at,
  concat_ws(' ', p.code, p.name, p.synthesis->'llm'->>'name', p.implementing_org, p.aliases::text, p.synthesis->'orgs', p.synthesis->'products', p.synthesis->'names',
            (SELECT string_agg(pl->>'name', ' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.synthesis->'places') = 'array' THEN p.synthesis->'places' ELSE '[]'::jsonb END) pl),
            p.synthesis->'llm'->>'summary', t.code, t.name, t.aliases::text, t.developer, src.source_text) AS search_text
FROM ai_projects p
LEFT JOIN ai_tools t ON t.id = p.tool_id
LEFT JOIN src ON src.project_id = p.id
LEFT JOIN tags tg ON tg.project_id = p.id
LEFT JOIN LATERAL (   -- the reach used for the size of a map dot: the largest achieved figure that counts people, else the largest target
  SELECT (r->>'number')::numeric AS number, r->>'unit' AS unit, COALESCE((r->>'is_target')::boolean, false) AS is_target, api.reach_class(r->>'unit') = 'people' AS people
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.synthesis->'reach') = 'array' THEN p.synthesis->'reach' ELSE '[]'::jsonb END) r
  WHERE r->>'number' ~ '^[0-9.]+$'
  ORDER BY (api.reach_class(r->>'unit') = 'people') DESC, COALESCE((r->>'is_target')::boolean, false), (r->>'number')::numeric DESC
  LIMIT 1
) rp ON true;

CREATE VIEW api.project_detail AS
SELECT c.*, p.synthesis, p.summary AS db_summary, t.aliases AS tool_aliases,
       rv.decision AS old_review_decision, rv.comment AS old_review_comment, rv.reviewer AS old_reviewer, rv.created_at AS old_reviewed_at
FROM api.project_cards c
JOIN ai_projects p ON p.id = c.id
LEFT JOIN ai_tools t ON t.id = p.tool_id
LEFT JOIN LATERAL (SELECT r.decision, r.comment, r.reviewer, r.created_at FROM project_reviews r WHERE r.project_id = p.id ORDER BY r.created_at DESC LIMIT 1) rv ON true;

-- One row per place of a deployment that has coordinates. A country-level place is left out when the deployment names something
-- more specific, so that a country's centre does not collect dots that say nothing.
CREATE VIEW api.map_points AS
WITH pl AS (
  SELECT p.id AS project_id, x.ord, x.v AS place, x.v->>'level' AS level
  FROM ai_projects p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.synthesis->'places') = 'array' THEN p.synthesis->'places' ELSE '[]'::jsonb END) WITH ORDINALITY x(v, ord)
  WHERE jsonb_typeof(x.v->'lat') = 'number' AND jsonb_typeof(x.v->'lon') = 'number' AND abs((x.v->>'lat')::numeric) <= 90 AND abs((x.v->>'lon')::numeric) <= 180
)
SELECT c.id AS project_id, c.code, c.name, c.tool_name, pl.ord,
       (pl.place->>'lat')::float8 AS lat, (pl.place->>'lon')::float8 AS lon, pl.place->>'name' AS place, pl.level,
       COALESCE(pl.place->>'admin1', '') AS admin1, COALESCE(NULLIF(pl.place->>'country', ''), c.countries[1], '') AS country,
       c.reach_number, c.reach_unit, c.reach_is_target, c.reach_is_people,
       c.domain_tags, c.countries, c.tech_categories, c.tech, c.stage, c.evidence_type, c.review_state, c.needs_attention, c.has_outcomes, c.has_cost, c.source_types, c.run_ids, c.search_text, c.analysed, c.score
FROM pl JOIN api.project_cards c ON c.id = pl.project_id
WHERE pl.level IS DISTINCT FROM 'country'
   OR NOT EXISTS (SELECT 1 FROM pl o WHERE o.project_id = pl.project_id AND o.level IS DISTINCT FROM 'country');

CREATE VIEW api.tool_cards AS
SELECT t.id, t.code, t.name, t.aliases, t.developer, t.created_at, t.updated_at,
       count(c.id) AS n_projects,
       count(c.id) FILTER (WHERE c.analysed) AS n_analysed_projects,
       COALESCE((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(array_agg(c.countries_flat)) x WHERE x IS NOT NULL AND x <> ''), '{}') AS countries,
       COALESCE((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(array_agg(c.tags_flat)) x WHERE x IS NOT NULL AND x <> ''), '{}') AS domain_tags,
       concat_ws(' ', t.code, t.name, t.aliases::text, t.developer) AS search_text
FROM ai_tools t
LEFT JOIN LATERAL (
  SELECT q.id, q.analysed, ct AS countries_flat, tg AS tags_flat
  FROM api.project_cards q LEFT JOIN LATERAL unnest(q.countries) ct ON true LEFT JOIN LATERAL unnest(q.domain_tags) tg ON true
  WHERE q.tool_id = t.id
) c ON true
GROUP BY t.id;

CREATE VIEW api.run_cards AS
SELECT r.id, r.started_at, r.finished_at, r.domain, r.counts, r.settings,
       r.settings->>'Search engine' AS engine, r.settings->'Countries' AS countries, r.settings->>'Max sources to analyse in depth' AS max_sources, r.settings->>'job_id' AS job_id,
       (SELECT count(*) FROM search_runs sr WHERE sr.pipeline_run = r.id) AS n_tasks,
       (SELECT COALESCE(sum(sr.input_tokens), 0) FROM search_runs sr WHERE sr.pipeline_run = r.id) AS input_tokens,
       (SELECT COALESCE(sum(sr.output_tokens), 0) FROM search_runs sr WHERE sr.pipeline_run = r.id) AS output_tokens
FROM runs r;

CREATE VIEW api.search_tasks AS
SELECT id, created_at, engine, country, language, source_type, candidates, duration_s, commands, web_searches, input_tokens, cached_input_tokens, output_tokens, run_id, queries, error, domain, pipeline_run, academic
FROM search_runs;

GRANT USAGE ON SCHEMA api TO web_ro, web_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_ro, web_rw;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO web_ro, web_rw;
-- these run with the rights of the tables owner: closed to everyone except the roles named here (and n8n, which owns them)
REVOKE EXECUTE ON FUNCTION ai4sg_save_review(BIGINT, TEXT, TEXT, TEXT, TEXT), ai4sg_move_source(BIGINT, TEXT, TEXT), ai4sg_detach_source(BIGINT, TEXT), ai4sg_merge_projects(TEXT, TEXT, TEXT),
  ai4sg_project_change(TEXT, BIGINT, TEXT, TEXT, TEXT), ai4sg_remove_empty_projects(BIGINT[]), ai4sg_forget_run(BIGINT), ai4sg_forget_run_preview(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai4sg_save_review(BIGINT, TEXT, TEXT, TEXT, TEXT), ai4sg_move_source(BIGINT, TEXT, TEXT), ai4sg_detach_source(BIGINT, TEXT),
  ai4sg_merge_projects(TEXT, TEXT, TEXT), ai4sg_forget_run(BIGINT), ai4sg_forget_run_preview(BIGINT) TO web_rw;
COMMIT;

-- searching by name stays fast as the tables grow
CREATE INDEX IF NOT EXISTS ai_projects_name_trgm ON ai_projects USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ai_tools_name_trgm ON ai_tools USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sources_title_trgm ON sources USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sources_title_en_trgm ON sources USING gin (title_en gin_trgm_ops);

-- reviews.reviewer_id points to web.users once the website has created that table (setup.sh applies this file again then)
DO $$ BEGIN
  IF to_regclass('web.users') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_reviewer_id_fkey') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES web.users(id) ON DELETE SET NULL;
  END IF;
END $$;
