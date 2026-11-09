# web/ · the AI4SG website

The full-stack site: pages, API, accounts and permissions. n8n stays behind it as the processing engine. The brief is `../handoff.md`.

```
browser ── pages + /api/* ──> web (Next.js)
                               ├─ reads: role web_ro, views in schema api (../db/web-schema.sql), filtered and paged on the server
                               ├─ its own data: role web_rw, schema web (users, sessions, jobs, audit_log; Drizzle migrations in drizzle/)
                               ├─ pipeline tables: only through the ai4sg_* database functions (../db/pipeline-schema.sql)
                               └─ anything that needs processing: src/pipeline/ ── shared key ──> n8n ── reports back ──> /api/internal/jobs/{id}
```

| Path | What is in it |
|---|---|
| `src/app/` | Pages and route handlers (`/api/*`) |
| `src/auth/` | Better Auth, roles, sessions, the mail hook |
| `src/db/` | Drizzle schema, the two connections, start-up (migrations, first administrator) |
| `src/lib/` | Filters, queries, the jobs service, the audit log, the `route()` wrapper every API route goes through |
| `src/pipeline/` | `PipelineAdapter` and its n8n implementation: the only code that talks to n8n or codex-runner |
| `src/components/` | Interface, map (`ProjectMap.tsx`), charts, forms |
| `tests/`, `e2e/` | Vitest (rules, and that every route declares its role); Playwright (the three roles, against `e2e/mock-pipeline.mjs`) |

## Run it

In production: `../setup.sh` builds and starts it as the compose service `web` (`127.0.0.1:3001`).

For development, copy `.env.example` to `.env.local`, fill it in, then:

```bash
npm install
npm run dev
```

It needs a Postgres with `../db/pipeline-schema.sql` and `../db/web-schema.sql` applied. Develop on a copy of the database, not the real one.

## Tests

```bash
npm test
```

End to end, on a copy of the database, with `N8N_URL` and `CODEX_RUNNER_URL` in `.env.local` set to `http://localhost:5699`:

```bash
N8N_WEBHOOK_SECRET=<same value as .env.local> node e2e/mock-pipeline.mjs
```

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium --only-shell
```

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test
```

The mock costs nothing: it stands in for n8n, codex-runner and OpenAI.

## Decisions worth knowing

- **First administrator**: created when the site first starts, from `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`. With no e-mail verification, letting that address sign up would let anyone claim it first, so registration refuses it.
- **Sign-up** goes through `/api/auth/register`, which checks the role. The library's own sign-up path is closed, and `role` can never be set from a request to the library.
- **Stored copies** are pages from other sites: `/api/sources/{id}/files/{name}` serves everything except PDFs with a `sandbox` Content-Security-Policy so they cannot run scripts on this site.
- **E-mail**: set `AUTH_REQUIRE_EMAIL_VERIFICATION=true` and `SMTP_*` to require verification; `SMTP_*` alone enables password reset. While off, those endpoints answer 501 and the links are hidden.
- **Charts are server-rendered HTML and one small SVG**, rather than ECharts: bars are links that set a filter, and nothing here needs a charting library. The map uses MapLibre directly. Lists are server-rendered, so TanStack Table and react-hook-form were not needed either.
- **Jobs** are confirmed by n8n's reports. If a report never arrives, the database decides (`reconcileJobs` in `src/lib/jobs.ts`) and a job cannot wait for ever.
