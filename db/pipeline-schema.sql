-- Tables for the skill-driven pipeline (A · Overview → B · Search → C · Extract & Interpretation).
-- Idempotent: setup.sh applies it on every run.

CREATE TABLE IF NOT EXISTS sources (
    id            BIGSERIAL PRIMARY KEY,
    url           TEXT        NOT NULL,
    url_norm      TEXT        NOT NULL UNIQUE,     -- lower-cased, no tracking params: used to skip known sources
    title         TEXT,
    source_type   TEXT,                            -- news | gov_report | gov_website | journal | conference_report | open_source | ...
    format        TEXT,                            -- html | pdf
    country       TEXT,
    language      TEXT,                            -- ISO 639-1 of the source text
    why_relevant  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extractions (
    id            BIGSERIAL PRIMARY KEY,
    source_id     BIGINT      NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    fields        JSONB,                           -- everything the Extraction Skill asked for, incl. evidence quotes
    flags         JSONB       NOT NULL DEFAULT '[]',  -- e.g. quote_not_found, cost_without_evidence, no_text_extracted
    confidence    REAL,
    status        TEXT        NOT NULL DEFAULT 'pending_review',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extractions_source_idx ON extractions (source_id);
CREATE INDEX IF NOT EXISTS extractions_created_idx ON extractions (created_at DESC);

-- v2: English title of the source (from the search step), shown on the audit page
ALTER TABLE sources ADD COLUMN IF NOT EXISTS title_en TEXT;

-- relevance score (0-100), computed by code from the extracted fields and verified quotes (see Extraction Skill section 9)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS relevance_score INT;

-- experts' pass / fail decisions from the audit page; the page shows the latest one per result
CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  extraction_id BIGINT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  decision      TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment       TEXT,
  reviewer      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_extraction_idx ON reviews (extraction_id, created_at DESC);

-- which search engine found the source: 'codex' (Codex CLI agent) or 'api' (single OpenAI call)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS search_engine TEXT;

-- one row per search task (country x language x source type), for comparing engines on time, tokens and yield
CREATE TABLE IF NOT EXISTS search_runs (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine              TEXT NOT NULL,
  country             TEXT,
  language            TEXT,
  source_type         TEXT,
  candidates          INT,              -- candidates returned (before de-duplication)
  duration_s          INT,
  commands            INT,              -- shell commands Codex ran (opening pages, reading PDFs ...)
  web_searches        INT,
  input_tokens        BIGINT,
  cached_input_tokens BIGINT,
  output_tokens       BIGINT,
  run_id              TEXT,             -- folder in ./codex-runs with the full transcript
  queries             JSONB,
  error               TEXT
);

-- domain chosen on the run page for the run that found the source: healthcare | public_service | agriculture | education | '' (all)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS domain TEXT;

-- ===== v9: runs, candidate queue, source library, projects =====
-- one row per run of the run page: settings and what happened (found, new, screened, analysed, queued ...)
CREATE TABLE IF NOT EXISTS runs (
  id           BIGSERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  domain       TEXT,
  settings     JSONB,
  counts       JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS pipeline_run BIGINT;   -- runs.id (run_id is the Codex session folder)
ALTER TABLE search_runs ADD COLUMN IF NOT EXISTS academic JSONB;     -- per database: query, hits, errors

-- every candidate the search returns is kept. status:
--   candidate -> collected | collect_failed -> passed (screen passed, waiting for analysis = "queued") | filtered_out -> extracted
ALTER TABLE sources ADD COLUMN IF NOT EXISTS run_id BIGINT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS doi TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS database TEXT;          -- openalex | europepmc | eric | web
ALTER TABLE sources ADD COLUMN IF NOT EXISTS found_via BIGINT REFERENCES sources(id) ON DELETE SET NULL;   -- cascade parent
ALTER TABLE sources ADD COLUMN IF NOT EXISTS found_via_url TEXT;     -- cascade parent's URL as the search gave it
ALTER TABLE sources ADD COLUMN IF NOT EXISTS relation TEXT;          -- cites | cited_by | mentioned_in
ALTER TABLE sources ADD COLUMN IF NOT EXISTS project_guess TEXT;     -- project name given by the search / the screen
ALTER TABLE sources ADD COLUMN IF NOT EXISTS files JSONB;            -- library manifest: downloaded files and their text size
ALTER TABLE sources ADD COLUMN IF NOT EXISTS text_chars INT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS screen JSONB;           -- relevance screen answer
ALTER TABLE sources ADD COLUMN IF NOT EXISTS screen_relevance REAL;
CREATE INDEX IF NOT EXISTS sources_status_idx ON sources (status, domain);
CREATE INDEX IF NOT EXISTS sources_doi_idx ON sources (lower(doi)) WHERE doi IS NOT NULL AND doi <> '';
UPDATE sources SET status = 'extracted' WHERE status IS NULL AND EXISTS (SELECT 1 FROM extractions e WHERE e.source_id = sources.id);

-- one row per AI project (the whole project: the same tool deployed in several places is one project).
-- (named ai_projects because the first version's dashboard left an unrelated "projects" table)
CREATE TABLE IF NOT EXISTS ai_projects (
  id               BIGSERIAL PRIMARY KEY,
  code             TEXT GENERATED ALWAYS AS ('P-' || lpad(id::text, 5, '0')) STORED,
  name             TEXT NOT NULL,
  aliases          JSONB NOT NULL DEFAULT '[]',
  implementing_org TEXT,
  countries        JSONB NOT NULL DEFAULT '[]',
  domain           TEXT,
  summary          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- which project each analysed source is about (method: new | auto | llm | manual)
CREATE TABLE IF NOT EXISTS source_projects (
  source_id   BIGINT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  project_id  BIGINT NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  method      TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_projects_project_idx ON source_projects (project_id);

-- v10: how much readable text each source has (full | abstract | none), download attempts (a failed or blocked download
-- is tried once more in a later run), and when it was last downloaded
ALTER TABLE sources ADD COLUMN IF NOT EXISTS text_level TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS collect_tries INT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
UPDATE sources SET collect_tries = 1 WHERE collect_tries IS NULL AND status IS DISTINCT FROM 'candidate' AND files IS NOT NULL;

-- v11: the experts audit PROJECTS. synthesis = the merged record of all the project's sources (C3 · Project Synthesis);
-- project_reviews = pass / fail per project, with the sources the project had at that moment
ALTER TABLE ai_projects ADD COLUMN IF NOT EXISTS synthesis JSONB;
CREATE TABLE IF NOT EXISTS project_reviews (
  id          SERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment     TEXT,
  reviewer    TEXT,
  source_ids  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_reviews_project_idx ON project_reviews (project_id, created_at DESC);

-- v15: domain tags. A source can belong to several domains (a TB-screening paper found by a public-service run belongs to
-- healthcare); the screen sets the tags, and a domain's queue and the audit page's domain filter use them. The run's domain
-- stays in sources.domain (where the source was found).
ALTER TABLE sources ADD COLUMN IF NOT EXISTS domain_tags TEXT[];
UPDATE sources SET domain_tags = ARRAY[domain] WHERE domain_tags IS NULL AND domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS sources_domain_tags_idx ON sources USING gin (domain_tags);
-- screens whose answer did not fit the format were saved as filtered out: put them back to be screened again
UPDATE sources s SET status = 'collected'
WHERE s.status = 'filtered_out' AND s.screen ? 'error' AND NOT EXISTS (SELECT 1 FROM extractions e WHERE e.source_id = s.id);

-- v17: the analysis selection of stage ② (GPT-6 Sol, from the screen's cards): for each queued source, whether it was chosen
-- for the in-depth analysis and why ({run_id, selected, rank, reason, method, at})
ALTER TABLE sources ADD COLUMN IF NOT EXISTS pick JSONB;

-- ===== v18: tools and their deployments; the organiser (stage ②) =====
-- A tool (an app, a model, a platform: "Plantix", "CottonAce") can be deployed several times; a project (ai_projects) is
-- ONE deployment ("Plantix — Bangladesh pilot"), the experts' unit of analysis. Before the in-depth analysis, the organiser
-- of stage ② (GPT-6 Sol, one call) groups the queued sources into deployments and tools, marks duplicate sources (the same
-- document found twice) and, with an analysis budget, chooses what to analyse. Experts review sources (reviews table).
CREATE TABLE IF NOT EXISTS ai_tools (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT GENERATED ALWAYS AS ('T-' || lpad(id::text, 5, '0')) STORED,
  name        TEXT NOT NULL,
  aliases     JSONB NOT NULL DEFAULT '[]',
  developer   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ai_projects ADD COLUMN IF NOT EXISTS tool_id BIGINT REFERENCES ai_tools(id) ON DELETE SET NULL;
ALTER TABLE ai_projects ADD COLUMN IF NOT EXISTS deployment JSONB;   -- {place, phase, org, country} as the organiser described it
-- a duplicate source (status 'duplicate') is the same document as another source (another URL, a preprint, a reprint): not analysed
ALTER TABLE sources ADD COLUMN IF NOT EXISTS duplicate_of BIGINT REFERENCES sources(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ai_projects_tool_idx ON ai_projects (tool_id);

-- the tool called `name` (by name or alias, ignoring case), created when unknown; NULL for an empty name
CREATE OR REPLACE FUNCTION ai4sg_tool_for(p_name TEXT, p_developer TEXT DEFAULT NULL) RETURNS BIGINT AS $$
DECLARE t BIGINT; n TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF n = '' OR lower(n) IN ('unknown', 'not stated', 'none', 'n/a') THEN RETURN NULL; END IF;
  SELECT id INTO t FROM ai_tools WHERE lower(name) = lower(n)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(aliases) a WHERE lower(a) = lower(n)) ORDER BY id LIMIT 1;
  IF t IS NULL THEN
    INSERT INTO ai_tools (name, developer) VALUES (n, NULLIF(btrim(COALESCE(p_developer, '')), '')) RETURNING id INTO t;
  END IF;
  RETURN t;
END $$ LANGUAGE plpgsql;

-- Apply the organiser's plan (built and checked by stage ②'s "Apply Organisation"):
--   tools    [{key, name, developer, aliases}]                     new tools ("T1" ...)
--   projects [{key, name, tool, org, country, place, phase, domain}] new deployments ("N1" ...); tool = "T-00003" or a new key
--   retool   [{project, tool}]                                     a tool for a known deployment that has none (or the wrong one)
--   merges   [{from, into, reason}]                                 known deployments that are the same one (P-codes)
--   sources  [{id, project, duplicate_of, reason, selected, rank, pick_reason}]   every queued source offered
-- Sources a reviewer placed by hand (method 'manual') and deployments holding one are never moved or merged.
-- Returns the sources to analyse now, in the organiser's order.
CREATE OR REPLACE FUNCTION ai4sg_apply_organisation(plan JSONB, p_run BIGINT, p_method TEXT)
RETURNS TABLE (source_id BIGINT, selected BOOLEAN, rank INT, project_id BIGINT) AS $$
#variable_conflict use_column
DECLARE
  x JSONB; tk JSONB := '{}'; pk JSONB := '{}'; t BIGINT; p BIGINT; f BIGINT; s BIGINT; d BIGINT;
BEGIN
  -- new tools (an existing tool of the same name is reused)
  FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(plan->'tools', '[]')) LOOP
    t := ai4sg_tool_for(x->>'name', x->>'developer');
    IF t IS NOT NULL THEN
      tk := tk || jsonb_build_object(x->>'key', t);
      UPDATE ai_tools SET updated_at = now(), developer = COALESCE(developer, NULLIF(x->>'developer', '')),
             aliases = (SELECT COALESCE(jsonb_agg(DISTINCT a), '[]') FROM jsonb_array_elements_text(aliases || COALESCE(x->'aliases', '[]')) a
                        WHERE lower(a) <> lower(name))
      WHERE id = t;
    END IF;
  END LOOP;
  -- new deployments
  FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(plan->'projects', '[]')) LOOP
    t := COALESCE((tk->>(x->>'tool'))::bigint, (SELECT id FROM ai_tools WHERE code = x->>'tool'));
    INSERT INTO ai_projects (name, implementing_org, countries, domain, summary, tool_id, deployment)
    VALUES (COALESCE(NULLIF(x->>'name', ''), 'Unnamed deployment'), NULLIF(x->>'org', ''),
            CASE WHEN COALESCE(x->>'country', '') = '' THEN '[]'::jsonb ELSE jsonb_build_array(x->>'country') END,
            NULLIF(x->>'domain', ''), NULL, t,
            jsonb_build_object('place', x->>'place', 'phase', x->>'phase', 'org', x->>'org', 'country', x->>'country', 'by', p_method))
    RETURNING id INTO p;
    pk := pk || jsonb_build_object(x->>'key', p);
  END LOOP;
  -- tools of known deployments
  FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(plan->'retool', '[]')) LOOP
    t := COALESCE((tk->>(x->>'tool'))::bigint, (SELECT id FROM ai_tools WHERE code = x->>'tool'));
    IF t IS NOT NULL THEN UPDATE ai_projects SET tool_id = t, updated_at = now() WHERE code = x->>'project'; END IF;
  END LOOP;
  -- merges of known deployments (into the older one; the other name becomes an alias)
  FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(plan->'merges', '[]')) LOOP
    SELECT id INTO f FROM ai_projects WHERE code = x->>'from';
    SELECT id INTO p FROM ai_projects WHERE code = x->>'into';
    IF f IS NULL OR p IS NULL OR f = p OR EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id IN (f, p) AND sp.method = 'manual') THEN
      CONTINUE;
    END IF;
    IF f < p THEN d := f; f := p; p := d; END IF;
    UPDATE ai_projects q SET updated_at = now(), tool_id = COALESCE(q.tool_id, o.tool_id),
           aliases = (SELECT COALESCE(jsonb_agg(DISTINCT a), '[]') FROM jsonb_array_elements_text(q.aliases || o.aliases || to_jsonb(ARRAY[o.name])) a
                      WHERE lower(a) <> lower(q.name))
    FROM ai_projects o WHERE q.id = p AND o.id = f;
    UPDATE source_projects SET project_id = p, method = 'merged', reason = left(COALESCE(x->>'reason', ''), 900), created_at = now()
    WHERE project_id = f;
    DELETE FROM ai_projects WHERE id = f;
    -- later references to the merged code point to the kept deployment
    pk := pk || jsonb_build_object(x->>'from', p);
  END LOOP;
  -- the sources: deployment, duplicates, selection
  FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(plan->'sources', '[]')) LOOP
    s := (x->>'id')::bigint;
    p := COALESCE((pk->>(x->>'project'))::bigint, (SELECT id FROM ai_projects WHERE code = x->>'project'));
    d := NULLIF(x->>'duplicate_of', '')::bigint;
    IF d IS NOT NULL AND (d = s OR NOT EXISTS (SELECT 1 FROM sources WHERE id = d)) THEN d := NULL; END IF;
    IF d IS NOT NULL THEN   -- a duplicate belongs where its original is
      p := COALESCE((SELECT sp.project_id FROM source_projects sp WHERE sp.source_id = d), p);
      UPDATE sources SET status = 'duplicate', duplicate_of = d WHERE id = s AND status = 'passed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM source_projects sp WHERE sp.source_id = s AND sp.method = 'manual') THEN
      IF p IS NOT NULL THEN
        INSERT INTO source_projects (source_id, project_id, method, reason)
        VALUES (s, p, CASE WHEN d IS NOT NULL THEN 'duplicate' ELSE 'organised' END, left(COALESCE(x->>'reason', ''), 900))
        ON CONFLICT ON CONSTRAINT source_projects_pkey DO UPDATE SET project_id = EXCLUDED.project_id, method = EXCLUDED.method,
          reason = EXCLUDED.reason, created_at = now();
      ELSE
        DELETE FROM source_projects sp WHERE sp.source_id = s AND sp.method IN ('organised', 'duplicate');
      END IF;
    END IF;
    UPDATE sources SET pick = jsonb_build_object('run_id', p_run, 'selected', COALESCE((x->>'selected')::boolean, false) AND d IS NULL,
                                                 'rank', NULLIF(x->>'rank', '')::int, 'reason', COALESCE(x->>'pick_reason', ''),
                                                 'group_reason', COALESCE(x->>'reason', ''), 'method', p_method, 'at', now())
    WHERE id = s;
  END LOOP;
  DELETE FROM ai_projects q WHERE NOT EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id = q.id);
  RETURN QUERY
    SELECT so.id, (so.pick->>'selected')::boolean, NULLIF(so.pick->>'rank', '')::int, sp.project_id
    FROM sources so LEFT JOIN source_projects sp ON sp.source_id = so.id
    WHERE so.id IN (SELECT (y->>'id')::bigint FROM jsonb_array_elements(COALESCE(plan->'sources', '[]')) y)
    ORDER BY (so.pick->>'selected')::boolean DESC, NULLIF(so.pick->>'rank', '')::int NULLS LAST, so.id;
END $$ LANGUAGE plpgsql;

-- ===== v19: the website (web/) =====
-- The website owns users, jobs and the audit log (schema "web"); it reads the views in schema "api" (db/web-schema.sql) and
-- changes the tables below only through these functions, so the same SQL serves the website and n8n.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_id TEXT;   -- web.users.id; older rows only have the typed name in "reviewer"
CREATE INDEX IF NOT EXISTS reviews_reviewer_idx ON reviews (reviewer_id, created_at DESC) WHERE reviewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS extractions_source_latest_idx ON extractions (source_id, created_at DESC, id DESC);

-- a Pass / Fail on a source: recorded against its latest extraction
CREATE OR REPLACE FUNCTION ai4sg_save_review(p_source BIGINT, p_decision TEXT, p_comment TEXT, p_reviewer TEXT, p_reviewer_id TEXT)
RETURNS TABLE (review_id INT, extraction_id BIGINT, decision TEXT, comment TEXT, reviewer TEXT, reviewed_at TIMESTAMPTZ) AS $$
#variable_conflict use_column
DECLARE x BIGINT;
BEGIN
  SELECT e.id INTO x FROM extractions e WHERE e.source_id = p_source ORDER BY e.created_at DESC, e.id DESC LIMIT 1;
  IF x IS NULL THEN RAISE EXCEPTION 'source % has no analysis to review', p_source USING ERRCODE = 'P0002'; END IF;
  RETURN QUERY
    INSERT INTO reviews (extraction_id, decision, comment, reviewer, reviewer_id)
    VALUES (x, p_decision, NULLIF(btrim(COALESCE(p_comment, '')), ''), NULLIF(btrim(COALESCE(p_reviewer, '')), ''), p_reviewer_id)
    RETURNING id, extraction_id, decision, comment, reviewer, created_at;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- deployments left without sources disappear; the ids that still exist are the ones to summarise again (C3)
CREATE OR REPLACE FUNCTION ai4sg_remove_empty_projects(p_ids BIGINT[]) RETURNS BIGINT[] AS $$
DECLARE kept BIGINT[];
BEGIN
  DELETE FROM ai_projects p WHERE NOT EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id = p.id);
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO kept FROM unnest(p_ids) x WHERE x IS NOT NULL AND EXISTS (SELECT 1 FROM ai_projects p WHERE p.id = x);
  RETURN kept;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- move one source to another deployment (a reviewer's placement: the organiser leaves it alone afterwards)
CREATE OR REPLACE FUNCTION ai4sg_move_source(p_source BIGINT, p_target TEXT, p_actor TEXT)
RETURNS TABLE (code TEXT, name TEXT, project_ids BIGINT[]) AS $$
#variable_conflict use_column
DECLARE t ai_projects%ROWTYPE; old BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sources s WHERE s.id = p_source) THEN RAISE EXCEPTION 'source % not found', p_source USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO t FROM ai_projects a WHERE a.code = p_target;
  IF t.id IS NULL THEN RAISE EXCEPTION 'project % not found', p_target USING ERRCODE = 'P0002'; END IF;
  SELECT sp.project_id INTO old FROM source_projects sp WHERE sp.source_id = p_source;
  INSERT INTO source_projects (source_id, project_id, method, reason)
  VALUES (p_source, t.id, 'manual', 'Changed by a reviewer' || CASE WHEN COALESCE(p_actor, '') <> '' THEN ' (' || p_actor || ')' ELSE '' END)
  ON CONFLICT ON CONSTRAINT source_projects_pkey DO UPDATE SET project_id = EXCLUDED.project_id, method = 'manual', reason = EXCLUDED.reason, created_at = now();
  RETURN QUERY SELECT t.code, t.name, ai4sg_remove_empty_projects(ARRAY[t.id, old]);
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- "not this project": the source gets a deployment of its own
CREATE OR REPLACE FUNCTION ai4sg_detach_source(p_source BIGINT, p_actor TEXT)
RETURNS TABLE (code TEXT, name TEXT, project_ids BIGINT[]) AS $$
#variable_conflict use_column
DECLARE t ai_projects%ROWTYPE; old BIGINT;
BEGIN
  SELECT sp.project_id INTO old FROM source_projects sp WHERE sp.source_id = p_source;
  INSERT INTO ai_projects (name, implementing_org, countries, domain, summary)
  SELECT COALESCE(NULLIF(e.fields->'project'->>'name', ''), s.project_guess, s.title, 'Unnamed project'), e.fields->'project'->>'implementing_org',
         COALESCE(e.fields->'project'->'countries', jsonb_build_array(s.country)), s.domain, e.fields->>'headline'
  FROM sources s LEFT JOIN LATERAL (SELECT x.fields FROM extractions x WHERE x.source_id = s.id ORDER BY x.created_at DESC, x.id DESC LIMIT 1) e ON true
  WHERE s.id = p_source
  RETURNING * INTO t;
  IF t.id IS NULL THEN RAISE EXCEPTION 'source % not found', p_source USING ERRCODE = 'P0002'; END IF;
  INSERT INTO source_projects (source_id, project_id, method, reason)
  VALUES (p_source, t.id, 'manual', 'Changed by a reviewer' || CASE WHEN COALESCE(p_actor, '') <> '' THEN ' (' || p_actor || ')' ELSE '' END)
  ON CONFLICT ON CONSTRAINT source_projects_pkey DO UPDATE SET project_id = EXCLUDED.project_id, method = 'manual', reason = EXCLUDED.reason, created_at = now();
  RETURN QUERY SELECT t.code, t.name, ai4sg_remove_empty_projects(ARRAY[t.id, old]);
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- every source of p_from moves into p_into; the old name is kept as an alias and the emptied deployment disappears
CREATE OR REPLACE FUNCTION ai4sg_merge_projects(p_from TEXT, p_into TEXT, p_actor TEXT)
RETURNS TABLE (code TEXT, name TEXT, project_ids BIGINT[]) AS $$
#variable_conflict use_column
DECLARE f ai_projects%ROWTYPE; t ai_projects%ROWTYPE;
BEGIN
  IF p_from = p_into THEN RAISE EXCEPTION 'a project cannot be merged into itself' USING ERRCODE = '22023'; END IF;
  SELECT * INTO f FROM ai_projects a WHERE a.code = p_from;
  SELECT * INTO t FROM ai_projects a WHERE a.code = p_into;
  IF f.id IS NULL THEN RAISE EXCEPTION 'project % not found', p_from USING ERRCODE = 'P0002'; END IF;
  IF t.id IS NULL THEN RAISE EXCEPTION 'project % not found', p_into USING ERRCODE = 'P0002'; END IF;
  UPDATE ai_projects p SET updated_at = now(),
         aliases = (SELECT COALESCE(jsonb_agg(DISTINCT a), '[]'::jsonb) FROM jsonb_array_elements_text(p.aliases || f.aliases || to_jsonb(ARRAY[f.name])) a WHERE lower(a) <> lower(p.name))
  WHERE p.id = t.id;
  UPDATE source_projects sp SET project_id = t.id, method = 'manual', created_at = now(),
         reason = 'Merged by a reviewer' || CASE WHEN COALESCE(p_actor, '') <> '' THEN ' (' || p_actor || ')' ELSE '' END
  WHERE sp.project_id = f.id;
  RETURN QUERY SELECT t.code, t.name, ai4sg_remove_empty_projects(ARRAY[t.id]);
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- one entry point for the n8n webhook ai4sg-project
CREATE OR REPLACE FUNCTION ai4sg_project_change(p_action TEXT, p_source BIGINT, p_from TEXT, p_target TEXT, p_actor TEXT)
RETURNS TABLE (code TEXT, name TEXT, project_ids BIGINT[]) AS $$
BEGIN
  IF p_action = 'detach' THEN RETURN QUERY SELECT * FROM ai4sg_detach_source(p_source, p_actor);
  ELSIF p_action = 'move' THEN RETURN QUERY SELECT * FROM ai4sg_move_source(p_source, p_target, p_actor);
  ELSIF p_action = 'merge' THEN RETURN QUERY SELECT * FROM ai4sg_merge_projects(p_from, p_target, p_actor);
  ELSE RAISE EXCEPTION 'action must be detach, move or merge' USING ERRCODE = '22023';
  END IF;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- what taking a run out would remove (the same selection ai4sg_forget_run uses)
CREATE OR REPLACE FUNCTION ai4sg_forget_run_preview(p_run BIGINT) RETURNS JSONB AS $$
DECLARE r runs%ROWTYPE; fin TIMESTAMPTZ;
BEGIN
  SELECT * INTO r FROM runs WHERE id = p_run;
  IF r.id IS NULL THEN RAISE EXCEPTION 'run % not found', p_run USING ERRCODE = 'P0002'; END IF;
  fin := COALESCE(r.finished_at, now());
  RETURN jsonb_build_object(
    'run_id', r.id, 'domain', r.domain, 'started_at', r.started_at, 'finished_at', r.finished_at,
    'sources', (SELECT count(*) FROM sources s WHERE s.run_id = p_run),
    'extractions', (SELECT count(*) FROM extractions x WHERE x.source_id IN (SELECT s.id FROM sources s WHERE s.run_id = p_run) OR x.created_at BETWEEN r.started_at AND fin),
    'projects', (SELECT count(*) FROM ai_projects p WHERE p.created_at BETWEEN r.started_at AND fin),
    'tools', (SELECT count(*) FROM ai_tools t WHERE t.created_at BETWEEN r.started_at AND fin));
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Take one run's results out of the database, as if the run had not happened. Nothing is destroyed: every row removed is copied
-- first into schema "archive" (tables archive.run<N>_*). Returns the run's source ids, whose library folders the caller moves.
CREATE OR REPLACE FUNCTION ai4sg_forget_run(p_run BIGINT) RETURNS JSONB AS $$
DECLARE
  r runs%ROWTYPE; fin TIMESTAMPTZ; src BIGINT[]; ext BIGINT[]; prj BIGINT[]; tl BIGINT[]; pre TEXT := 'run' || p_run;
BEGIN
  SELECT * INTO r FROM runs WHERE id = p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'run % not found', p_run USING ERRCODE = 'P0002'; END IF;
  IF to_regclass('archive.' || pre || '_sources') IS NOT NULL THEN RAISE EXCEPTION 'run % was already taken out', p_run USING ERRCODE = '22023'; END IF;
  fin := COALESCE(r.finished_at, now());
  SELECT COALESCE(array_agg(id), '{}') INTO src FROM sources WHERE run_id = p_run;
  SELECT COALESCE(array_agg(id), '{}') INTO ext FROM extractions x WHERE x.source_id = ANY(src) OR x.created_at BETWEEN r.started_at AND fin;
  SELECT COALESCE(array_agg(id), '{}') INTO prj FROM ai_projects p WHERE p.created_at BETWEEN r.started_at AND fin;
  SELECT COALESCE(array_agg(id), '{}') INTO tl FROM ai_tools t WHERE t.created_at BETWEEN r.started_at AND fin;

  CREATE SCHEMA IF NOT EXISTS archive;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM runs WHERE id = $1', pre || '_runs') USING p_run;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM search_runs WHERE pipeline_run = $1', pre || '_search_runs') USING p_run;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM sources WHERE id = ANY($1) OR pick->>''run_id'' = $2', pre || '_sources') USING src, p_run::text;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM extractions WHERE id = ANY($1)', pre || '_extractions') USING ext;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM reviews WHERE extraction_id = ANY($1)', pre || '_reviews') USING ext;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM source_projects WHERE source_id = ANY($1) OR project_id = ANY($2)', pre || '_source_projects') USING src, prj;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM ai_projects WHERE id = ANY($1)', pre || '_ai_projects') USING prj;
  EXECUTE format('CREATE TABLE archive.%I AS SELECT * FROM ai_tools WHERE id = ANY($1)', pre || '_ai_tools') USING tl;

  CREATE TEMP TABLE f_ext_src ON COMMIT DROP AS SELECT DISTINCT source_id FROM extractions WHERE id = ANY(ext);
  DELETE FROM extractions WHERE id = ANY(ext);                                        -- (reviews go with them)
  UPDATE sources s SET status = 'passed'                                              -- older sources the run analysed: back to the queue
  WHERE s.id IN (SELECT source_id FROM f_ext_src) AND NOT s.id = ANY(src) AND s.status = 'extracted'
    AND NOT EXISTS (SELECT 1 FROM extractions x WHERE x.source_id = s.id);
  UPDATE sources SET pick = NULL WHERE pick->>'run_id' = p_run::text;
  UPDATE sources SET status = 'passed', duplicate_of = NULL WHERE duplicate_of = ANY(src);
  DELETE FROM source_projects WHERE source_id = ANY(src) OR project_id = ANY(prj);
  DELETE FROM sources WHERE id = ANY(src);
  DELETE FROM ai_projects p WHERE p.id = ANY(prj) OR NOT EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id = p.id);
  DELETE FROM ai_tools t WHERE t.id = ANY(tl) AND NOT EXISTS (SELECT 1 FROM ai_projects p WHERE p.tool_id = t.id);
  DELETE FROM search_runs WHERE pipeline_run = p_run;
  DELETE FROM runs WHERE id = p_run;
  RETURN jsonb_build_object('run_id', p_run, 'source_ids', to_jsonb(src), 'extractions', cardinality(ext), 'projects', cardinality(prj), 'tools', cardinality(tl));
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ===== v20: fewer duplicate sources and deployments =====
-- Trigram similarity for choosing known deployments (db/web-schema.sql creates it too; it is a trusted extension, so the owner can).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- One normalised form of a title. A new candidate and the library are compared with this same function. Before v20 the candidate
-- side was normalised in JavaScript, which drops the vowel signs of Hindi, Bengali or Thai where this keeps them, so a known
-- source in those scripts found again under another URL was not recognised.
CREATE OR REPLACE FUNCTION ai4sg_title_norm(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT trim(regexp_replace(lower(COALESCE(t, '')), '[^[:alnum:]]+', ' ', 'g')) $$;
CREATE INDEX IF NOT EXISTS sources_title_norm_idx ON sources (ai4sg_title_norm(title));

-- The known deployments the organiser (stage ②, GPT-6 Sol) is shown for a queue, at most p_limit plus the possible duplicates of
-- those. Before v20 it was the newest 300 of the domain or of the queue's countries, which soon meant all deployments, so older
-- ones were not shown and could be created again. Now in this order: deployments that already hold a source of the queue; those
-- whose name, alias or tool appears in what a queued source of a shared country says about itself; the domain's; the rest of the
-- queue's countries (newest first within each). maybe_same lists the shown deployments that share a country with this one and
-- have the same tool and a similar name, or a very similar name: the organiser checks those pairs on every run and merges the
-- ones that are one deployment.
CREATE OR REPLACE FUNCTION ai4sg_known_projects(p_domain TEXT, p_ids BIGINT[], p_limit INT DEFAULT 400)
RETURNS TABLE (id BIGINT, code TEXT, name TEXT, aliases JSONB, implementing_org TEXT, countries JSONB, deployment JSONB,
               tool_code TEXT, tool_name TEXT, sources JSONB, manual BOOLEAN, why TEXT, maybe_same JSONB) AS $$
WITH q AS (     -- what each queued source says about its deployment
  SELECT s.id, lower(COALESCE(s.country, '')) AS country,
         lower(concat_ws(' ', s.screen->>'project_name', s.project_guess, s.screen->'card'->>'deployment', s.screen->'card'->>'title_en')) AS txt
  FROM sources s WHERE s.id = ANY(p_ids)
),
qc AS (SELECT array_agg(DISTINCT q.country) FILTER (WHERE q.country <> '') AS cs FROM q),
pr AS (
  SELECT p.id, p.tool_id, lower(p.name) AS n, p.updated_at,
         COALESCE((SELECT array_agg(DISTINCT lower(c)) FROM jsonb_array_elements_text(p.countries) c), '{}') AS cs
  FROM ai_projects p
),
nm AS (         -- the names a deployment goes by: its own, its aliases, its tool's
  SELECT p.id, lower(x.n) AS n
  FROM ai_projects p LEFT JOIN ai_tools t ON t.id = p.tool_id,
       LATERAL (SELECT p.name UNION ALL SELECT jsonb_array_elements_text(p.aliases)
                UNION ALL SELECT t.name UNION ALL SELECT jsonb_array_elements_text(COALESCE(t.aliases, '[]'))) x(n)
  WHERE length(COALESCE(x.n, '')) >= 4
),
hit AS (        -- how clearly the queue names each deployment: the best match over queued sources of a shared country
  SELECT nm.id, max(word_similarity(nm.n, q.txt)) AS score
  FROM nm JOIN pr ON pr.id = nm.id JOIN q ON q.txt <> '' AND (q.country = '' OR pr.cs = '{}' OR q.country = ANY(pr.cs))
  GROUP BY nm.id
),
held AS (SELECT DISTINCT sp.project_id AS id FROM source_projects sp WHERE sp.source_id = ANY(p_ids)),
dom AS (SELECT DISTINCT sp.project_id AS id FROM source_projects sp JOIN sources s ON s.id = sp.source_id
        WHERE p_domain = '' OR p_domain = ANY(COALESCE(s.domain_tags, ARRAY[s.domain]))),
ranked AS (
  SELECT pr.id,
         CASE WHEN held.id IS NOT NULL THEN 'holds a queued source' WHEN COALESCE(hit.score, 0) >= 0.6 THEN 'named in the queue'
              WHEN dom.id IS NOT NULL THEN 'same domain' ELSE 'same country' END AS why,
         row_number() OVER (ORDER BY (held.id IS NOT NULL) DESC, (COALESCE(hit.score, 0) >= 0.6) DESC, COALESCE(hit.score, 0) DESC,
                                     (dom.id IS NOT NULL) DESC, pr.updated_at DESC, pr.id) AS rk
  FROM pr CROSS JOIN qc LEFT JOIN held ON held.id = pr.id LEFT JOIN hit ON hit.id = pr.id LEFT JOIN dom ON dom.id = pr.id
  WHERE held.id IS NOT NULL OR COALESCE(hit.score, 0) >= 0.6 OR dom.id IS NOT NULL OR pr.cs && COALESCE(qc.cs, '{}')
),
top AS (SELECT r.id, r.why, r.rk FROM ranked r WHERE r.rk <= p_limit),
pairs AS (      -- deployments that may be one and the same, where at least one of the two is shown
  SELECT a.id AS a, b.id AS b
  FROM pr a JOIN pr b ON a.id <> b.id
   AND (a.id IN (SELECT top.id FROM top) OR b.id IN (SELECT top.id FROM top))
   AND (a.cs && b.cs OR a.cs = '{}' OR b.cs = '{}')
   AND ((a.tool_id = b.tool_id AND similarity(a.n, b.n) >= 0.5) OR similarity(a.n, b.n) >= 0.7)
),
listed AS (
  SELECT top.id, top.why, top.rk FROM top
  UNION ALL
  SELECT DISTINCT pairs.b, 'may be the same as a shown deployment', p_limit + 1
  FROM pairs WHERE pairs.a IN (SELECT top.id FROM top) AND pairs.b NOT IN (SELECT top.id FROM top)
)
SELECT p.id, p.code, p.name, p.aliases, p.implementing_org, p.countries, p.deployment, t.code, t.name,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object('sid', x.id, 'title', COALESCE(x.screen->>'headline_en', x.title_en, x.title, x.url),
                                                     'status', x.status, 'type', x.source_type) ORDER BY x.id), '[]'::jsonb)
        FROM (SELECT s.* FROM source_projects sp JOIN sources s ON s.id = sp.source_id WHERE sp.project_id = p.id ORDER BY s.id LIMIT 5) x),
       EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id = p.id AND sp.method = 'manual'),
       l.why,
       (SELECT COALESCE(jsonb_agg(o.code ORDER BY o.id), '[]'::jsonb)
        FROM pairs JOIN ai_projects o ON o.id = pairs.b WHERE pairs.a = p.id AND pairs.b IN (SELECT listed.id FROM listed))
FROM listed l JOIN ai_projects p ON p.id = l.id LEFT JOIN ai_tools t ON t.id = p.tool_id
ORDER BY l.rk, p.id
$$ LANGUAGE sql STABLE;

-- The known tools the organiser is shown, at most p_limit (before v20 the newest 500): the tools of the shown deployments, then
-- those whose name or alias appears in the queue, then the newest. A new tool with the name or alias of a known one is reused
-- anyway (ai4sg_tool_for); this list is what lets the organiser reuse a tool whose name is written differently.
CREATE OR REPLACE FUNCTION ai4sg_known_tools(p_ids BIGINT[], p_tool_codes TEXT[], p_limit INT DEFAULT 1000)
RETURNS TABLE (code TEXT, name TEXT, aliases JSONB, developer TEXT, deployments BIGINT) AS $$
WITH q AS (
  SELECT lower(concat_ws(' ', s.screen->>'project_name', s.project_guess, s.screen->'card'->>'deployment', s.screen->'card'->>'title_en',
                         s.screen->'card'->>'ai_method')) AS txt
  FROM sources s WHERE s.id = ANY(p_ids)
),
hit AS (
  SELECT t.id, max(word_similarity(lower(x.n), q.txt)) AS score
  FROM ai_tools t, LATERAL (SELECT t.name UNION ALL SELECT jsonb_array_elements_text(t.aliases)) x(n), q
  WHERE length(COALESCE(x.n, '')) >= 4 AND q.txt <> ''
  GROUP BY t.id
)
SELECT t.code, t.name, t.aliases, t.developer, (SELECT count(*) FROM ai_projects p WHERE p.tool_id = t.id)
FROM ai_tools t LEFT JOIN hit ON hit.id = t.id
ORDER BY (t.code = ANY(COALESCE(p_tool_codes, '{}'))) DESC, (COALESCE(hit.score, 0) >= 0.6) DESC, t.updated_at DESC, t.id
LIMIT p_limit
$$ LANGUAGE sql STABLE;
