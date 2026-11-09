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

[ "$(psqlq -At -c "SELECT count(*) FROM runs WHERE id = $RUN")" = 1 ] || die "run $RUN not found"
psqlq -At -c "SELECT 'run ' || (p->>'run_id') || ' · ' || COALESCE(p->>'domain', 'all domains') || ' · started ' || left(p->>'started_at', 16) || E'\nsources found by the run:      ' || (p->>'sources') || E'\nextractions made in the run:   ' || (p->>'extractions') || E'\nprojects created in the run:   ' || (p->>'projects') FROM ai4sg_forget_run_preview($RUN) p"
[ "${2:-}" = "--yes" ] || { echo; echo "Nothing changed. To take this run out: ./forget-run.sh $RUN --yes"; exit 0; }

# the rows: copied to schema archive, then taken out (the same function the website uses)
psqlq -At -c "SELECT ai4sg_forget_run($RUN)" >/dev/null

# the run's downloaded files: library/<source id>/ -> library-archive/run<N>/<source id>/
mkdir -p "library-archive/run$RUN"
moved=0
for id in $(psqlq -At -c "SELECT id FROM archive.run${RUN}_sources WHERE run_id = $RUN"); do
  if [ -d "library/$id" ]; then mv "library/$id" "library-archive/run$RUN/$id"; moved=$((moved + 1)); fi
done
echo "Run $RUN taken out. Copies of every removed row: database schema archive (archive.run${RUN}_*); $moved downloaded"
echo "source folders moved to library-archive/run$RUN/. The audit page no longer shows the run."
