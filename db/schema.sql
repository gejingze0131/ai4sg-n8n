-- AI for Social Good project catalogue (runs once, on first Postgres start, inside database "ai4sg")

CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY,              -- "<source>:<source_id>", stable across runs
    source        TEXT        NOT NULL,          -- github | arxiv | news
    source_id     TEXT        NOT NULL,
    title         TEXT        NOT NULL,
    url           TEXT        NOT NULL,
    description   TEXT,
    owner         TEXT,                          -- repo owner / first authors / news outlet
    published_at  TIMESTAMPTZ,
    stars         INTEGER,                       -- GitHub only
    language      TEXT,                          -- GitHub only
    topics        JSONB       NOT NULL DEFAULT '[]',
    project_type  TEXT,                          -- open-source | research | news
    domain        TEXT,                          -- primary impact domain (see README)
    sdgs          JSONB       NOT NULL DEFAULT '[]',   -- e.g. [3, 5]
    region        TEXT,
    org_type      TEXT,                          -- academic | nonprofit | company | government | community | unknown
    summary       TEXT,
    relevance     REAL,                          -- 0..1
    is_relevant   BOOLEAN     NOT NULL DEFAULT FALSE,
    analyzed_by   TEXT        NOT NULL DEFAULT 'rules',  -- rules | llm
    first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_domain_idx     ON projects (domain);
CREATE INDEX IF NOT EXISTS projects_first_seen_idx ON projects (first_seen DESC);
CREATE INDEX IF NOT EXISTS projects_relevant_idx   ON projects (is_relevant);

-- One row per workflow run, for monitoring the pipeline
CREATE TABLE IF NOT EXISTS collection_runs (
    run_id        BIGSERIAL PRIMARY KEY,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fetched       INTEGER,
    new_items     INTEGER,
    relevant      INTEGER,
    llm_analyzed  INTEGER,
    per_source    JSONB
);
