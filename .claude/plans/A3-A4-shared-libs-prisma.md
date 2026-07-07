# Shared Libraries + Prisma Setup

## Context

The task-platform monorepo currently has two bare NestJS apps (`task-platform`, `reminder-worker`) with no shared infrastructure: no config validation, no DB client, no structured logging, no consistent error shape, and no health checks. This work builds the `libs/common` shared library plus the Prisma schema/migration/seed so both apps have a consistent foundation (config, DB, logging, errors, health) before any business-logic modules are added. Docker Compose (postgres, redis) is already running on the host; `task-platform`/`reminder-worker` containers are not yet rebuilt with these changes.

Per CLAUDE.md: Controller → Service → Repository separation, ConfigService only (never `process.env`), NestJS HTTP exceptions only, lint+tests before done, feature branch only (already on `feature/shared-libs-prisma`).

**Decision confirmed with user:** use `bcryptjs` (pure JS) instead of native `bcrypt` for the seed script, to avoid native build toolchain issues on Windows host + Alpine container.

**Decision confirmed with user:** after running `nest g library common`, show the resulting `tsconfig.json` path alias before proceeding with the rest of implementation.

## Part 1 — `libs/common` shared library

Run `npx nest g library common` (accept default `@app` prefix → import path `@app/common`). This registers a `common` project in `nest-cli.json` and a `@app/common` path in `tsconfig.json`.

Repurpose the generated `libs/common/src/common.module.ts` into an aggregator that imports/exports the submodules below, so apps can do `imports: [CommonModule]`.

### 1a. `libs/common/src/config/`
- `env.validation.ts` — Joi schema requiring `DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY, SENTRY_DSN, NODE_ENV, PORT` (NODE_ENV enum, PORT number, rest required strings).
- `app-config.service.ts` — `AppConfigService` wraps Nest's `ConfigService`, exposes typed getters (`databaseUrl`, `redisUrl`, `jwtSecret`, `jwtRefreshSecret`, `fcmProjectId`, `fcmClientEmail`, `fcmPrivateKey`, `sentryDsn`, `nodeEnv`, `port`) using `getOrThrow`.
- `config.module.ts` — `AppConfigModule`, `@Global()`, calls `NestConfigModule.forRoot({ isGlobal: true, validationSchema })`, provides/exports only `AppConfigService` (not the raw `ConfigService`) so the rest of the codebase depends on the typed wrapper.
- `index.ts` barrel.

### 1b. `libs/common/src/prisma/`
- `prisma.service.ts` — `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`, connects/disconnects.
- `prisma.module.ts` — `@Global() PrismaModule`, provides/exports `PrismaService`.

### 1c. `libs/common/src/interceptors/`
- `logging.module.ts` — wraps `nestjs-pino`'s `LoggerModule.forRoot(...)`, configuring `pino-http` with a custom `genReqId` that reads `X-Correlation-ID` or generates one via `crypto.randomUUID()` (no `uuid` dependency needed, Node 20 has it built in), and stores it on `req.correlationId`.
- `logging.interceptor.ts` — `LoggingInterceptor implements NestInterceptor`: on entry records start time; on completion (via `tap`/`finalize` in the RxJS pipe) logs `{ method, path, statusCode, duration, correlationId, userId }` through the injected Pino logger. `userId` reads `req.user?.id ?? null` (no auth yet, will be `null`). Also sets response header `X-Correlation-ID`.
- `index.ts` barrel.

### 1d. `libs/common/src/filters/`
- `global-exception.filter.ts` — `@Catch() GlobalExceptionFilter implements ExceptionFilter`. Reads `correlationId` off the request (falls back to a freshly generated uuid if absent, e.g. exception thrown by a guard before the interceptor ran). If `HttpException`, uses its status + message/response as `error.message`/`error.code` (code derived from exception class name or `HttpStatus` name). Otherwise 500, logs full stack via Pino, generic `code: 'INTERNAL_ERROR'`. Always responds:
  ```json
  { "success": false, "error": { "code": "...", "message": "...", "correlationId": "..." } }
  ```

### 1e. `libs/common/src/health/`
- `health.module.ts` — imports `PrismaModule`; provides a singleton `ioredis` client under an injection token (`REDIS_CLIENT`) via `useFactory` reading `AppConfigService.redisUrl`; disconnects it in `onModuleDestroy`.
- `health.controller.ts`:
  - `GET /health` → always `{ status: 'ok' }`.
  - `GET /ready` → runs `prisma.$queryRaw\`SELECT 1\`` and `redis.ping()` independently (each wrapped in try/catch so one failure doesn't block checking the other), builds `{ status, db, redis }`, and if either failed sets HTTP 503 via `@Res({ passthrough: true })` (bypasses GlobalExceptionFilter's shape, since this endpoint has its own contract).
- `index.ts` barrel.

`common.module.ts` imports `AppConfigModule, PrismaModule, LoggingModule, HealthModule` and exports `AppConfigModule, PrismaModule`.

## Part 2 — Prisma schema + migration

- Root: `npm install prisma @prisma/client` (client is a runtime dep; `prisma` CLI as devDependency: `npm install -D prisma`).
- `prisma/schema.prisma` — add `generator client { provider = "prisma-client-js" }` and `datasource db { provider = "postgresql", url = env("DATABASE_URL") }` blocks, then the exact schema body from the task spec (User, RefreshToken, FcmToken, Workspace, WorkspaceMember, Project, Sprint, Task, Reminder, Notification, SyncOperation + enums), verbatim.
- **Networking note:** `.env`'s `DATABASE_URL` uses hostname `postgres` (correct for containers, unresolvable from the host). Docker Compose already publishes postgres on `localhost:5432`, so migration/seed/studio commands run from the host with a one-off override, e.g. (bash):
  `DATABASE_URL="postgresql://taskplatform:secret@localhost:5432/taskplatform" npx prisma migrate dev --name init`
  `.env` itself is left unchanged (still correct for in-container use by the apps).
- This generates `prisma/migrations/<timestamp>_init/` and the Prisma Client into host `node_modules`.

## Part 3 — Seed script

- `npm install bcryptjs` + `npm install -D @types/bcryptjs`.
- `prisma/seed.ts`: creates workspace "Family", 2 users (owner + member, `bcryptjs.hash("password123", 10)`), 1 project "Personal" under Family, 3 tasks with different `status` values, 1 `Reminder` on the first task with `scheduledAt` = now + 1h. Instantiates `PrismaClient` directly (seed scripts run outside Nest DI).
- `package.json` → add `"prisma": { "seed": "ts-node prisma/seed.ts" }`.
- Run seed with the same host-override pattern: `DATABASE_URL="postgresql://taskplatform:secret@localhost:5432/taskplatform" npx prisma db seed`.

## Part 4 — Wire into both apps

- `apps/task-platform/src/app.module.ts`: `imports: [CommonModule]`, add `providers: [{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }, { provide: APP_FILTER, useClass: GlobalExceptionFilter }]`.
- `apps/task-platform/src/main.ts`: replace `process.env.PORT` with `app.get(AppConfigService).port`; add `app.useLogger(app.get(Logger))` (nestjs-pino) so Nest's internal logging also goes through Pino.
- Same two changes mirrored in `apps/reminder-worker/src/reminder-worker.module.ts` and `apps/reminder-worker/src/main.ts` (currently uses lowercase `process.env.port`, also a bug — fixed by switching to `AppConfigService.port`).

## Part 5 — Docker healthcheck

- `docker-compose.yml`, `task-platform` service: add the healthcheck block exactly as specified (`curl -f http://localhost:3000/health`, 30s/10s/3/40s).
- `apps/task-platform/Dockerfile.dev` needs `RUN apk add --no-cache curl` added (node:20-alpine has no curl by default, so the healthcheck would fail without it).
- `reminder-worker`: no healthcheck (no HTTP port published), no Dockerfile change.

## New dependencies (root `package.json`)

Runtime: `@nestjs/config`, `joi`, `@prisma/client`, `nestjs-pino`, `pino-http`, `pino`, `ioredis`, `bcryptjs`
Dev: `prisma`, `@types/bcryptjs`

## Verification

1. `npm run lint` and `npm run test` (unit tests — CLAUDE.md requires this before done; no reminder state-machine logic exists yet so no new spec file is required for that rule).
2. `docker compose up --build -d`
3. `docker compose ps` → `task-platform` shows `(healthy)`
4. `curl http://localhost:3000/health` → `{ status: 'ok' }`
5. `curl http://localhost:3000/ready` → `{ status: 'ok', db: 'ok', redis: 'ok' }`
6. `npx prisma studio` (host, with the same `DATABASE_URL` localhost override) → confirm all tables exist with seed data
7. `curl http://localhost:3000/unknown-route` → `{ success: false, error: { code, message, correlationId } }`
8. `docker compose logs task-platform` → confirm Pino JSON logs include `correlationId`

Report actual results of each step back to the user rather than assuming success.

## Amendments applied during execution

- `npx nest g library common` doesn't accept `--prefix` non-interactively; invoked the underlying schematic directly (`node node_modules/@angular-devkit/schematics-cli/bin/schematics.js @nestjs/schematics:library --name=common ... --prefix="@app"`) to get the same result non-interactively. Confirmed `tsconfig.json` got `"@app/common": ["libs/common/src"]`.
- `npm install prisma @prisma/client` pulled Prisma **7.8.0** by default, which replaced `prisma-client-js` with a new `prisma-client` generator (custom `output` path, needs `prisma.config.ts`). Per user decision, pinned both packages to `6.19.3` to keep the classic generator/import pattern the spec assumed. This is now also recorded in the root `CLAUDE.md` under a new "Dependencies" section.
- Used `bcryptjs` instead of native `bcrypt` (user decision, avoids native build toolchain on Windows host + Alpine container). Also recorded in `CLAUDE.md`.
- `libs/common/src/health/health.controller.ts`: `@Res({ passthrough: true }) res: Response` failed to compile (`TS1272`) under `isolatedModules` + `emitDecoratorMetadata` — fixed by changing to `import type { Response } from 'express'`.
- Both `Dockerfile.dev` files were missing `RUN npx prisma generate` after `COPY . .` — without it, the Prisma Client has no generated engine and throws `@prisma/client did not initialize yet` at runtime. Added to both `apps/task-platform/Dockerfile.dev` and `apps/reminder-worker/Dockerfile.dev` (reminder-worker also depends on `PrismaModule` transitively via `CommonModule`).
- First rebuild still failed with the same Prisma error even after adding `prisma generate`, because docker-compose's anonymous `node_modules` volume (`/usr/src/app/node_modules`) was reused from the earlier broken build. Fixed by rebuilding with `docker compose up --build -d --renew-anon-volumes` (does not touch the named `postgres-data`/`redis-data` volumes — seed data survived).
- Docker Compose for this project wasn't actually running at the start of the session (only unrelated containers were up); started `postgres`/`redis` manually before running migrations.
- Ran `prisma migrate dev`, `prisma db seed`, and later verification `curl`/psql checks from the host against `localhost:5432`/`3000` (with a one-off `DATABASE_URL` override for the Prisma CLI commands, per the plan's networking note) rather than inside the container.

## Verification results (actual)

1. `npm run lint` — clean except 7 pre-existing errors in `apps/reminder-worker/test/app.e2e-spec.ts` (unmodified file, not part of this change). `npm test` — 2 suites / 2 tests passed.
2. `docker compose up --build -d` — succeeded (after the two Dockerfile fixes + anon-volume renew).
3. `docker compose ps` — `taskplatform-api` shows `Up ... (healthy)`.
4. `curl http://localhost:3000/health` → `{"status":"ok"}`.
5. `curl http://localhost:3000/ready` → `{"status":"ok","db":"ok","redis":"ok"}`.
6. Verified seed data via `psql` counts instead of opening Prisma Studio's UI (headless session): 2 users, 1 workspace, 3 tasks, 1 reminder — matches Part 3 spec.
7. `curl http://localhost:3000/unknown-route` → `{"success":false,"error":{"code":"NOT_FOUND","message":"Cannot GET /unknown-route","correlationId":"..."}}`.
8. `docker compose logs task-platform` — Pino JSON logs present, each request log includes `correlationId`; confirmed `X-Correlation-ID` request header is honored and echoed back on the response.
