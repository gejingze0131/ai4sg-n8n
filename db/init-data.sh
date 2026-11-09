#!/bin/bash
# Runs once, the first time the Postgres volume is initialised.
# Creates: a non-root user for n8n, the n8n metadata DB grants, and the "ai4sg" data DB with its schema.
set -e

if [ -z "${POSTGRES_NON_ROOT_USER:-}" ] || [ -z "${POSTGRES_NON_ROOT_PASSWORD:-}" ]; then
  echo "SETUP INFO: POSTGRES_NON_ROOT_USER / POSTGRES_NON_ROOT_PASSWORD missing" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER "${POSTGRES_NON_ROOT_USER}" WITH PASSWORD '${POSTGRES_NON_ROOT_PASSWORD}';
  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB}" TO "${POSTGRES_NON_ROOT_USER}";
  GRANT CREATE ON SCHEMA public TO "${POSTGRES_NON_ROOT_USER}";
  CREATE DATABASE "${AI4SG_DB:-ai4sg}" OWNER "${POSTGRES_NON_ROOT_USER}";
EOSQL

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_NON_ROOT_USER}" --dbname "${AI4SG_DB:-ai4sg}" -f /schema/schema.sql
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_NON_ROOT_USER}" --dbname "${AI4SG_DB:-ai4sg}" -f /schema/pipeline-schema.sql
echo "SETUP INFO: ai4sg database and schema created"
