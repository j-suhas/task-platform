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

## Module Structure

Every NestJS module must follow this folder layout:

```
controllers/ → services/ → repositories/ → dto/ → entities/
```

Apps in this monorepo:

- `task-platform` — main API
- `reminder-worker` — background processor

## Error Handling

- Always use NestJS built-in HTTP exceptions (NotFoundException, BadRequestException, etc.)
- Never throw raw Error objects from controllers or services
- All errors must include a machine-readable code and human-readable message
- Global exception filter handles formatting — do not format errors in controllers

## Environment Config

- Never hardcode secrets, URLs, or environment-specific values
- Always access config via ConfigService — never process.env directly
- App must fail fast on startup if required env vars are missing (Joi validation)

## Dependencies

- Password hashing: bcryptjs (never bcrypt)
- Prisma: pin to v6.x (v7 generator pattern not yet mature for NestJS)

## Session Logs

After every session, save the proposed plan to `.claude/plans/<phase-name>.md` before marking the task complete. File should contain:

- Plan as proposed (sections, file list, decisions made)
- Any amendments applied

## Post-MVP (Out of Scope)

The following are explicitly out of MVP scope. Do not implement unless instructed:

- Attachments / file storage
- Contact / entity linking
- Sprint planning
- Finance, habits, learning modules
- Voice capture / URL share quick capture

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

## Security Patterns

- Passwords → bcryptjs (slow hash, random salt, compare only)
- Tokens/API keys → SHA-256 (fast, deterministic, DB lookup safe)
- Never use bcrypt for token storage — lookup is impossible
