# Repo Scaffolding + CLAUDE.md Constitution

## Context

The repo was a freshly generated NestJS monorepo (`apps/task-platform` + `apps/reminder-worker`) with no commits yet. Before any real feature work (Prisma, Docker, auth, reminders) started, baseline project hygiene and a project "constitution" (CLAUDE.md) were needed so future work follows consistent conventions. Confirmed via read-only checks at the time: no `.gitignore`, `.editorconfig`, `.env.example`, or `CLAUDE.md` existed yet at the root, so all five items were net-new files (no conflicts/overwrites). A `.prettierrc` already existed (`{ singleQuote: true, trailingComma: "all" }`) and already matched Nest's generator default, so it was left untouched rather than replaced.

Note: user initially referred to the main app as `apps/main-app`; actual folder name is `apps/task-platform` — used the real name throughout.

## Plan as proposed

### 1. `.gitignore`
Standard Node/NestJS/Docker ignore list: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.log`, `npm-debug.log*`, `.env`, `.env.*.local`, `.DS_Store`, `Thumbs.db`, IDE folders, `*.tsbuildinfo`, `docker-compose.override.yml`.

### 2. `.env.example`
One key per line, no values, short comment above each: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `SENTRY_DSN`, `NODE_ENV`, `PORT`.

### 3. `README.md` (replaces default Nest boilerplate)
Sections: title + project description (personal task management platform), Tech Stack, Apps (`task-platform` = main API, `reminder-worker` = background worker), Local Setup (placeholder), Architecture (diagram placeholder).

### 4. `CLAUDE.md`
Project constitution with sections: Stack, Architecture Pattern (Controller → Service → Repository, no mixed responsibilities), Testing (unit tests required for reminder state-machine logic), Definition of Done (lint + test before done), Git Workflow (never commit to `main`, Conventional Commits with examples).

### 5. `.editorconfig`
Standard Nest/TS defaults: `root = true`, UTF-8, LF, 2-space indent, trim trailing whitespace, insert final newline. `.prettierrc` left as-is.

**Out of scope (per user instruction):** no Prisma schema/config, no Dockerfile/docker-compose — only ignore-pattern lines and doc mentions of these as planned stack items.

**Verification:** `git status` confirmed the 5 new files as untracked with no unintended files touched; `.env.example` keys matched the 10 requested keys exactly; README/CLAUDE.md rendered as valid Markdown.

## Amendments applied

Two follow-up sections were added to `CLAUDE.md` after the initial scaffolding, per explicit user request (not part of the original plan-mode session):

1. **Module Structure** — every NestJS module must follow `controllers/ → services/ → repositories/ → dto/ → entities/`; documented the two app names (`task-platform` = main API, `reminder-worker` = background processor).
2. **Post-MVP (Out of Scope)** — explicit frozen list so future sessions don't accidentally build: attachments/file storage, contact/entity linking, sprint planning, finance/habits/learning modules, voice capture / URL share quick capture.

Both were inserted directly via `Edit` (no plan-mode step needed — pure documentation additions, no code/architecture ambiguity).

## Final state

Files created/modified: `.gitignore`, `.env.example`, `.editorconfig`, `README.md`, `CLAUDE.md` (all at repo root). No Prisma or Docker files touched. Nothing committed yet as of this log — still pending a feature-branch commit per the Git Workflow rule in `CLAUDE.md`.
