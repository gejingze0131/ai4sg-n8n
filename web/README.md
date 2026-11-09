# web/ — AI4SG management website (to be built)

This folder is where the next stage is built: a full-stack website that replaces the single audit page and the run form
served by n8n. Read `../handoff.md` first; it is the brief.

Decided (2026-11-09):
- Framework: **Next.js** (App Router, TypeScript). Auth: **Better Auth** (email + password).
- Roles: visitor, expert, admin. Sign-up page lets people choose visitor or expert (`EXPERT_SIGNUP=open`); no email
  verification yet, but the hooks and the `AUTH_REQUIRE_EMAIL_VERIFICATION` switch are kept for later.
- First admin: the owner's e-mail, set as `ADMIN_EMAIL` in `.env` (never committed).
- No analysis quota. Map base tiles may come from the internet (free vector tiles), with `geo.json` as fallback.

Planned layout (create as you go):

```
web/
├── README.md            this file
├── package.json
├── next.config.ts
├── drizzle.config.ts
├── .env.example         DATABASE_URL_RO, DATABASE_URL_RW, BETTER_AUTH_SECRET, ADMIN_EMAIL, N8N_URL, N8N_WEBHOOK_SECRET, MAP_STYLE_URL, …
├── Dockerfile           built and started by ../docker-compose.yml (service "web")
├── drizzle/             migrations for the "web" schema (users, sessions, jobs, audit_log)
└── src/
    ├── app/             pages and route handlers (/api/*)
    ├── components/      UI (shadcn/ui), charts, map
    ├── db/              Drizzle schema, read-only views of the pipeline tables
    ├── auth/            Better Auth config, roles, permission checks
    └── pipeline/        PipelineAdapter: the only code that calls n8n
```
