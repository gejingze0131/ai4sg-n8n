#!/usr/bin/env bash
# Take one run's results out of the database, as if the run had not happened (e.g. a test run, or a run made with a bug).
# Nothing is destroyed: every row removed is copied first into the database schema "archive" (tables archive.run<N>_*),
# and the run's downloaded files are moved from library/ to library-archive/run<N>/.
#   ./forget-run.sh 4          show what would be taken out
#   ./forget-run.sh 4 --yes    take it out
# What a run leaves: its runs row and search tasks; the sources it found (with their extractions, reviews and project
# links); the extractions it made of older sources (those go back to the queue); the projects and tools created while it
# ran; the analysis selection it recorded on older queued sources.
set -euo pipefail
cd "$(dirname "$0")"
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
RUN="${1:-}"; [[ "$RUN" =~ ^[0-9]+$ ]] || die "usage: ./forget-run.sh <run id> [--yes]   (run ids: first column of the runs table on the audit page)"
envget() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
U="$(envget POSTGRES_NON_ROOT_USER)"; DB="$(envget AI4SG_DB)"; DB="${DB:-ai4sg}"
psqlq() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$U" -d "$DB" -v run="$RUN" "$@"; }

psqlq -At -F ' | ' <<'SQL'
SELECT 'run ' || id || ' · ' || COALESCE(domain, 'all domains') || ' · started ' || to_char(started_at, 'YYYY-MM-DD HH24:MI') FROM runs WHERE id = :run;
SELECT 'sources found by the run:      ' || count(*) FROM sources WHERE run_id = :run;
SELECT 'extractions made in the run:   ' || count(*) FROM extractions x, runs r
 WHERE r.id = :run AND (x.source_id IN (SELECT id FROM sources WHERE run_id = :run)
                        OR x.created_at BETWEEN r.started_at AND COALESCE(r.finished_at, now()));
SELECT 'projects created in the run:   ' || count(*) FROM ai_projects p, runs r
 WHERE r.id = :run AND p.created_at BETWEEN r.started_at AND COALESCE(r.finished_at, now());
SQL
[ "$(psqlq -At -c "SELECT count(*) FROM runs WHERE id = $RUN")" = 1 ] || die "run $RUN not found"
[ "${2:-}" = "--yes" ] || { echo; echo "Nothing changed. To take this run out: ./forget-run.sh $RUN --yes"; exit 0; }
[ "$(psqlq -At -c "SELECT to_regclass('archive.run${RUN}_sources') IS NULL")" = t ] || die "run $RUN was already taken out (archive.run${RUN}_sources exists)"

psqlq <<'SQL'
BEGIN;
CREATE SCHEMA IF NOT EXISTS archive;
CREATE TEMP TABLE f_run AS SELECT id, started_at, COALESCE(finished_at, now()) AS finished_at FROM runs WHERE id = :run;
CREATE TEMP TABLE f_src AS SELECT id FROM sources WHERE run_id = :run;
CREATE TEMP TABLE f_ext AS SELECT x.id, x.source_id FROM extractions x, f_run r
  WHERE x.source_id IN (SELECT id FROM f_src) OR x.created_at BETWEEN r.started_at AND r.finished_at;
CREATE TEMP TABLE f_prj AS SELECT p.id FROM ai_projects p, f_run r WHERE p.created_at BETWEEN r.started_at AND r.finished_at;
CREATE TEMP TABLE f_tool AS SELECT t.id FROM ai_tools t, f_run r WHERE t.created_at BETWEEN r.started_at AND r.finished_at;

-- copies first (archive.run<N>_<table>)
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM runs WHERE id = %s', 'run' || :run || '_runs', :run) \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM search_runs WHERE pipeline_run = %s', 'run' || :run || '_search_runs', :run) \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM sources WHERE id IN (SELECT id FROM f_src) OR pick->>''run_id'' = %L', 'run' || :run || '_sources', :run) \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM extractions WHERE id IN (SELECT id FROM f_ext)', 'run' || :run || '_extractions') \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM reviews WHERE extraction_id IN (SELECT id FROM f_ext)', 'run' || :run || '_reviews') \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM source_projects WHERE source_id IN (SELECT id FROM f_src) OR project_id IN (SELECT id FROM f_prj)', 'run' || :run || '_source_projects') \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM ai_projects WHERE id IN (SELECT id FROM f_prj)', 'run' || :run || '_ai_projects') \gexec
SELECT format('CREATE TABLE archive.%I AS SELECT * FROM ai_tools WHERE id IN (SELECT id FROM f_tool)', 'run' || :run || '_ai_tools') \gexec

-- then take it out
DELETE FROM extractions WHERE id IN (SELECT id FROM f_ext);                       -- (reviews go with them)
UPDATE sources s SET status = 'passed'                                              -- older sources the run analysed: back to the queue
WHERE s.id IN (SELECT source_id FROM f_ext) AND s.id NOT IN (SELECT id FROM f_src) AND s.status = 'extracted'
  AND NOT EXISTS (SELECT 1 FROM extractions x WHERE x.source_id = s.id);
UPDATE sources SET pick = NULL WHERE pick->>'run_id' = :'run';
UPDATE sources SET status = 'passed', duplicate_of = NULL WHERE duplicate_of IN (SELECT id FROM f_src);
DELETE FROM source_projects WHERE source_id IN (SELECT id FROM f_src) OR project_id IN (SELECT id FROM f_prj);
DELETE FROM sources WHERE id IN (SELECT id FROM f_src);
DELETE FROM ai_projects WHERE id IN (SELECT id FROM f_prj) OR NOT EXISTS (SELECT 1 FROM source_projects sp WHERE sp.project_id = ai_projects.id);
DELETE FROM ai_tools t WHERE t.id IN (SELECT id FROM f_tool) AND NOT EXISTS (SELECT 1 FROM ai_projects p WHERE p.tool_id = t.id);
DELETE FROM search_runs WHERE pipeline_run = :run;
DELETE FROM runs WHERE id = :run;
COMMIT;
SQL

# the run's downloaded files: library/<source id>/ -> library-archive/run<N>/<source id>/
mkdir -p "library-archive/run$RUN"
moved=0
for id in $(psqlq -At -c "SELECT id FROM archive.run${RUN}_sources WHERE run_id = $RUN"); do
  if [ -d "library/$id" ]; then mv "library/$id" "library-archive/run$RUN/$id"; moved=$((moved + 1)); fi
done
echo "Run $RUN taken out. Copies of every removed row: database schema archive (archive.run${RUN}_*); $moved downloaded"
echo "source folders moved to library-archive/run$RUN/. The audit page no longer shows the run."
