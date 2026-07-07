# Local Development Docker Compose Setup

## Context

The repo had no local dev orchestration yet — no way to run `task-platform`, `reminder-worker`, Postgres, and Redis together with hot reload. Before Prisma/business-logic work could be developed against a real Postgres instance, this session set up `docker-compose.yml`, per-app dev Dockerfiles, `.env`, and Makefile shortcuts.

Key discovery during exploration: this is a NestJS **monorepo** with a single root `package.json`/`node_modules`/`nest-cli.json` (`nest-cli.json:10-31` registers both `task-platform` and `reminder-worker` as projects under one root). There is no per-app `package.json`. This meant each app's Dockerfile couldn't build/run standing alone from its own subfolder — it needs the repo root's shared config present, which shaped the build-context and volume-mount decisions below (see "Decisions" section).

Plan Mode was used first per user request; the plan was approved with two amendments requested before execution (see Amendments).

## Plan as proposed

### 1. `docker-compose.yml` (root)
- `postgres`: `postgres:16-alpine`, port `5432:5432`, named volume `postgres-data`, env `POSTGRES_DB/USER/PASSWORD=taskplatform/taskplatform/secret`, healthcheck via `pg_isready`.
- `redis`: `redis:7-alpine`, port `6379:6379`, named volume `redis-data`, healthcheck via `redis-cli ping`.
- `task-platform`: build context repo root, port `3000:3000`, `env_file: .env`, `depends_on` postgres/redis (`condition: service_healthy`), bind mount `.:/usr/src/app` + anonymous volume on `/usr/src/app/node_modules`.
- `reminder-worker`: same pattern, no ports, `depends_on` postgres/redis (`service_healthy`) + task-platform (`service_started`).
- All four on a named bridge network `taskplatform-network`.

### 2. `apps/task-platform/Dockerfile.dev`
`node:20-alpine`, `npm ci`, `COPY . .`, `EXPOSE 3000`, `CMD ["npm", "run", "start:dev"]` (root `start:dev` script = `nest start --watch`, defaults to the `task-platform` project since it's `nest-cli.json`'s root project).

### 3. `apps/reminder-worker/Dockerfile.dev`
Same base pattern. `CMD ["npm", "run", "start:dev", "--", "reminder-worker"]` — reuses the existing `start:dev` script rather than inventing a new one, passing `reminder-worker` through `--` so it resolves to `nest start --watch reminder-worker`.

### 4. `.env` (gitignored)
Created from `.env.example` with the specified local values: `DATABASE_URL`/`REDIS_URL` pointing at the `postgres`/`redis` service hostnames, JWT secrets, FCM/Sentry placeholders, `NODE_ENV=development`, `PORT=3000`.

### 5. `docker-compose.override.yml` (gitignored — rule already existed)
Empty placeholder file for local per-developer overrides.

### 6. `Makefile` (root)
`up`, `down`, `logs`, `logs-app`, `logs-worker`, `ps`, `shell-app`, `shell-db`, `clean` — thin wrappers over the equivalent `docker compose` commands.

### Decisions made
- **Build context = repo root**, not `apps/<name>`, for both Dockerfiles (`dockerfile:` path still lives under each app folder). Required so `npm ci` sees the root `package.json`/`package-lock.json` and the built image has `nest-cli.json` + both apps' source, since the monorepo has no per-app manifest.
- **Bind mount = whole repo root**, not just the app subfolder, for the same reason — `nest --watch` resolves projects via the shared root `nest-cli.json`.
- **`node_modules` masked via anonymous volume** (`/usr/src/app/node_modules` with no host source) so the host's `node_modules` never shadows the image's `npm ci` output — verified post-run via `docker inspect` showing that path backed by a Docker-managed volume, not the bind mount.

## Amendments applied

Two changes were requested by the user before execution (during Plan Mode review, not part of the original plan draft):

1. **Verify `reminder-worker`'s watch command against root `package.json` scripts** — confirmed no dedicated `reminder-worker` script exists; used the existing `start:dev` script with `-- reminder-worker` passed through instead of introducing a new command.
2. **Add `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true`** to both `task-platform` and `reminder-worker` services, anticipating that bind-mounted source on Docker Desktop for Windows doesn't reliably deliver native filesystem events into the container.

Two further issues surfaced during verification and were fixed in the same session:

3. **`CHOKIDAR_USEPOLLING=true` alone crash-looped `task-platform`** — chokidar in this version calls `fs.watchFile` with `interval: undefined`, which Node 20 rejects (`ERR_INVALID_ARG_TYPE`). Fixed by also setting `CHOKIDAR_INTERVAL=1000` on both app services.
4. **Build context transfer took ~5 minutes** (161MB+, mostly host `node_modules` and `.git`) because nothing excluded them. Added a root `.dockerignore` (`node_modules`, `dist`, `build`, `out-tsc`, `coverage`, `.git`, IDE folders, `*.log`, `.env*`). Rebuild after the fix transferred ~4KB and completed in seconds.

## Verification

Ran the full checklist from the task spec, in order, against the running stack:
1. `docker compose config` — valid.
2. `docker compose up --build -d` — all 4 images built, all 4 containers created (first run surfaced the chokidar crash above; fixed and re-run).
3. `docker compose ps` — postgres/redis `healthy`, task-platform/reminder-worker `Up`.
4. `curl http://localhost:3000` → `Hello World!` (200).
5. `docker compose logs task-platform` — clean Nest bootstrap, no errors after the fix.
6. `docker compose logs reminder-worker` — confirmed it initializes `ReminderWorkerModule` (not `AppModule`), i.e. the CLI is targeting the correct project.
7. Hot reload: edited `apps/task-platform/src/app.service.ts` on the host, polled the endpoint — webpack rebuilt and Nest restarted (new process ID) in ~1s, no container rebuild needed. Edit reverted after confirming.
8. `docker inspect taskplatform-api` — confirmed `/usr/src/app/node_modules` is backed by a Docker-managed volume, not the host bind mount.
9. `docker compose down` — clean shutdown, named volumes (`postgres-data`, `redis-data`) preserved.
10. `git status --short` — confirmed `.env` and `docker-compose.override.yml` do not appear as untracked (already covered by existing `.gitignore` rules).

## Final state

Files created: `docker-compose.yml`, `apps/task-platform/Dockerfile.dev`, `apps/reminder-worker/Dockerfile.dev`, `.env` (gitignored), `docker-compose.override.yml` (gitignored), `Makefile`, `.dockerignore` (root). All verification steps passed; stack currently stopped (`docker compose down` was the last command run) with named volumes intact. Nothing committed yet — pending a feature-branch commit per the Git Workflow rule in `CLAUDE.md`.
