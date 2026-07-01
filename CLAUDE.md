# CLAUDE.md

Project constitution for the Task Platform repo. Follow these rules for all work in this repo.

## Stack

- NestJS monorepo, TypeScript
- Prisma + PostgreSQL
- BullMQ + Redis
- JWT auth (access + refresh tokens)

## Architecture Pattern

Controller → Service → Repository. Never mix responsibilities across layers:

- **Controller**: HTTP concerns only (routing, request/response DTOs, status codes). No business logic, no direct DB access.
- **Service**: business logic and orchestration. No HTTP concerns, no raw queries.
- **Repository**: data access only (Prisma calls). No business logic.

## Testing

- Always write unit tests for reminder state-machine logic.

## Definition of Done

- Always run lint and tests before considering a task complete.

## Git Workflow

- Never commit directly to `main`. Work on feature branches and merge via PR.
- Use Conventional Commits: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
  - `feat: add reminder snooze endpoint`
  - `fix: correct timezone offset in reminder scheduler`
  - `chore: bump nestjs to 11.0.2`
  - `docs: document env variables`
  - `test: cover reminder state transitions`
  - `refactor: extract reminder repository from service`
