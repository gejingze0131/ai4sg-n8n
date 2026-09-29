#!/usr/bin/env bash
# One-shot setup: secrets -> containers -> DB tables -> credentials + workflows imported and published.
#   ./setup.sh             first-time setup (safe to re-run: skips the workflow import once done)
#   ./setup.sh --reimport  re-import workflows/credentials from ./n8n (overwrites edits made in the n8n UI!)
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker not found. Install Docker Desktop or OrbStack first."
docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker Desktop / OrbStack and retry."
command -v openssl >/dev/null || die "openssl not found."
[ -f skills/search/SKILL.md ] && [ -f skills/extraction/SKILL.md ] || die "skills/search/SKILL.md and skills/extraction/SKILL.md are required."

# ---------- 1. .env with random secrets ----------
if [ ! -f .env ]; then say "Creating .env with random secrets"; cp .env.example .env; fi
for var in N8N_ENCRYPTION_KEY RUNNERS_AUTH_TOKEN POSTGRES_PASSWORD POSTGRES_NON_ROOT_PASSWORD; do
  if grep -q "^${var}=CHANGE_ME" .env; then
    sed "s|^${var}=CHANGE_ME.*|${var}=$(openssl rand -hex 24)|" .env > .env.tmp && mv .env.tmp .env
  fi
done
grep -q "^OPENAI_API_KEY=" .env || printf '\nOPENAI_API_KEY=\nOPENAI_BASE_URL=https://api.openai.com/v1\n' >> .env
# settings added later: append to an existing .env without touching the rest
grep -q "^AI4SG_PAGE_USER=" .env || printf '\nAI4SG_PAGE_USER=ai4sg\n' >> .env
grep -q "^AI4SG_PAGE_PASSWORD=" .env || printf 'AI4SG_PAGE_PASSWORD=CHANGE_ME\n' >> .env
grep -q "^PUBLIC_URL=" .env || printf 'PUBLIC_URL=\n' >> .env
if grep -q "^AI4SG_PAGE_PASSWORD=CHANGE_ME" .env; then   # short enough to type, 12 random characters
  sed "s|^AI4SG_PAGE_PASSWORD=CHANGE_ME.*|AI4SG_PAGE_PASSWORD=$(openssl rand -hex 6)|" .env > .env.tmp && mv .env.tmp .env
fi
chmod 600 .env
# read .env without sourcing it (values may contain characters the shell would interpret)
envget() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
for v in N8N_VERSION GENERIC_TIMEZONE POSTGRES_USER POSTGRES_DB POSTGRES_NON_ROOT_USER POSTGRES_NON_ROOT_PASSWORD AI4SG_DB OPENAI_API_KEY OPENAI_BASE_URL AI4SG_PAGE_USER AI4SG_PAGE_PASSWORD PUBLIC_URL; do
  export "$v=$(envget "$v")"
done
[ -n "$OPENAI_API_KEY" ] || warn "OPENAI_API_KEY is empty in .env. Setup continues, but the pipeline cannot run until you add it and run ./setup.sh --reimport."

# ---------- 2. database first ----------
say "Starting Postgres (first run downloads ~1 GB of images)"
docker compose up -d postgres
for i in $(seq 1 90); do
  docker compose exec -T postgres pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  [ "$i" = 90 ] && die "Postgres did not start. Check: docker compose logs postgres"
  sleep 2
done

# ---------- 3. make sure the n8n user, the ai4sg database and all tables exist ----------
# (db/init-data.sh only runs on the very first start; this repairs a database whose first start was interrupted)
say "Checking database user, databases and tables"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v u="$POSTGRES_NON_ROOT_USER" -v pw="$POSTGRES_NON_ROOT_PASSWORD" -v n8ndb="$POSTGRES_DB" -v appdb="${AI4SG_DB:-ai4sg}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'u') \gexec
ALTER ROLE :"u" WITH LOGIN PASSWORD :'pw';
GRANT ALL PRIVILEGES ON DATABASE :"n8ndb" TO :"u";
GRANT CREATE ON SCHEMA public TO :"u";
SELECT format('CREATE DATABASE %I OWNER %I', :'appdb', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'appdb') \gexec
SQL
for f in schema.sql pipeline-schema.sql; do
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_NON_ROOT_USER" -d "${AI4SG_DB:-ai4sg}" -f "/schema/$f"
done

# ---------- 4. n8n ----------
say "Starting n8n ${N8N_VERSION} (first start runs database migrations and can take a few minutes)"
docker compose up -d
docker compose restart n8n >/dev/null   # in case it was stuck retrying with a missing database user
for i in $(seq 1 150); do
  curl -fsS "http://localhost:5678/healthz" >/dev/null 2>&1 && break
  [ "$i" = 150 ] && die "n8n did not start in time. Check: docker compose logs n8n --tail 50"
  sleep 2
done

# ---------- 5. credentials + workflows ----------
# Published = always on. B and C must be published to be callable; D serves the audit page;
# A is published so its run page has a fixed address (a run only starts when someone submits that page).
PUBLISH_IDS="ai4sgPipeline001 ai4sgSearchAgt01 ai4sgExtract0001 ai4sgAuditPage01"
if [ -f .setup-done ] && [ "${1:-}" != "--reimport" ]; then
  say "Workflows already imported (run ./setup.sh --reimport to overwrite them)."
else
  esc() { printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'; }
  jesc() { esc "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"; }   # JSON-escape, then sed-escape
  rm -rf n8n/.render && mkdir -p n8n/.render
  sed -e "s|__AI4SG_DB__|$(jesc "${AI4SG_DB:-ai4sg}")|" \
      -e "s|__PG_USER__|$(jesc "$POSTGRES_NON_ROOT_USER")|" \
      -e "s|__PG_PASSWORD__|$(jesc "$POSTGRES_NON_ROOT_PASSWORD")|" \
      -e "s|__OPENAI_API_KEY__|$(jesc "${OPENAI_API_KEY:-CHANGE_ME}")|" \
      -e "s|__OPENAI_BASE_URL__|$(jesc "${OPENAI_BASE_URL:-https://api.openai.com/v1}")|" \
      -e "s|__PAGE_USER__|$(jesc "$AI4SG_PAGE_USER")|" \
      -e "s|__PAGE_PASSWORD__|$(jesc "$AI4SG_PAGE_PASSWORD")|" \
      n8n/credentials/credentials.template.json > n8n/.render/credentials.json
  chmod 644 n8n/.render/credentials.json   # readable by the container's "node" user; deleted right after import

  say "Importing into n8n"
  for id in $PUBLISH_IDS ai4sgCollect0001 ai4sgDashboard01; do   # published workflows must be unpublished before overwrite
    docker compose exec -T n8n n8n unpublish:workflow --id=$id >/dev/null 2>&1 || true
  done
  docker compose exec -T n8n n8n import:credentials --input=/import/.render/credentials.json
  rm -f n8n/.render/credentials.json
  docker compose exec -T n8n n8n import:workflow --separate --input=/import/pipeline
  for id in $PUBLISH_IDS; do docker compose exec -T n8n n8n publish:workflow --id=$id; done

  say "Restarting n8n so the published workflows go live"
  docker compose restart n8n
  for i in $(seq 1 60); do curl -fsS "http://localhost:5678/healthz" >/dev/null 2>&1 && break; sleep 2; done
  date > .setup-done
fi

BASE="${PUBLIC_URL:-http://localhost:5678/}"; BASE="${BASE%/}"
cat <<EOF

  n8n editor : $BASE   (first visit: create the owner account)
  Run page   : $BASE/form/ai4sg-run
  Audit page : $BASE/webhook/ai4sg-audit
  Page login : user "$AI4SG_PAGE_USER", password "$AI4SG_PAGE_PASSWORD"   (run page and audit page; stored in .env)
  Skills     : ./skills/search/SKILL.md, ./skills/extraction/SKILL.md (+ examples/). Edits apply on the next run.

  To run: open the run page, choose countries, source types and limits, click "Start run".
  (Or open "AI4SG · A Overview" in n8n and click "Execute workflow" to watch the run live.)
  To let other people in over the internet: ./share.sh on   (stop with ./share.sh off)
EOF
