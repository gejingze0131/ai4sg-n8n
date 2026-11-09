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
