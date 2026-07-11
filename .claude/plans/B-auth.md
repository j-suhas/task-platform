# Auth Module — Backend

## Context

The task-platform monorepo has `libs/common` in place (PrismaService, AppConfigService, LoggingInterceptor, GlobalExceptionFilter, health endpoints) but no auth. The Prisma schema already has `User`, `RefreshToken`, `FcmToken` models ready. This phase adds JWT-based auth (register/login/refresh/logout, FCM token registration, a global JWT guard with an opt-out `@Public()` decorator) so every future module can assume `req.user` is populated, per CLAUDE.md's Controller → Service → Repository pattern.

**Resolved during planning:** the spec's "hash the refresh token with bcryptjs, then look it up by `findRefreshToken(token)`" is contradictory — bcrypt salts randomly per call, so a bcrypt hash can't be found via equality lookup without already knowing the candidate row. Confirmed with user: use **SHA-256** (deterministic, `node:crypto`) for the refresh-token storage/lookup hash instead, since refresh tokens are high-entropy signed JWTs (not guessable secrets like passwords) — bcryptjs remains reserved for password hashing per CLAUDE.md. This keeps the repository's single-param `findRefreshToken(token)` signature and the existing `RefreshToken.token @unique` column working as a direct indexed lookup.

**Other gaps filled vs. the literal spec (all mechanical, no behavior ambiguity):**
- Repository needs `findUserById(id)` (not listed in the spec's method list, but required by `getCurrentUser` and by `refresh()` to re-fetch `email` for the new access-token payload, since the refresh JWT payload only carries `sub`).
- `@Public()` and `@CurrentUser()` must live in `libs/common/src/decorators/` (not inside the auth module) because `libs/common/src/health/health.controller.ts` also needs `@Public()` once the global guard is wired up — a lib can't depend on an app.
- Existing `RequestWithCorrelation.user` interface already has shape `{ id: string }` (used by `logging.interceptor.ts` as `request.user?.id`). `JwtStrategy.validate()` returns `{ id: payload.sub, email: payload.email }` to match it exactly, rather than the spec's literal `{ userId, email }` — that naming was only ever meant for the JWT payload's `sub` claim, not the req.user shape. Extended the interface's `user` field to `{ id: string; email: string }`.
- `AppController`'s existing root `GET /` and `HealthController`'s `GET /health` / `GET /ready` marked `@Public()`, otherwise the new global guard would have broken them.

## Dependencies installed

Runtime: `@nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcryptjs cookie-parser class-validator class-transformer`
Dev: `@types/passport-jwt @types/passport-local @types/cookie-parser`

(`bcryptjs` was already a runtime dep. `class-validator`/`class-transformer` weren't in package.json but are required for the DTOs and `ValidationPipe`. `passport-local` installed per spec for forward-compat, not wired to a `LocalStrategy` in this phase.)

## File plan (as executed)

### `libs/common/src/decorators/` (new)
- `public.decorator.ts` — `IS_PUBLIC_KEY = 'isPublic'`, `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`
- `current-user.decorator.ts` — `createParamDecorator` reading `request.user`
- `index.ts` barrel
- `libs/common/src/interceptors/request-with-correlation.interface.ts`: `user?: { id: string; email: string }`
- `libs/common/src/index.ts` exports `./decorators`
- `libs/common/src/health/health.controller.ts`: `@Public()` added to `liveness()` and `readiness()`
- `apps/task-platform/src/app.controller.ts`: `@Public()` added to `getHello()`

### `apps/task-platform/src/modules/auth/`
```
dto/
  register.dto.ts        — email (IsEmail), name (IsString, MinLength 2), password (IsString, MinLength 8)
  login.dto.ts            — email (IsEmail), password (IsString)
  token-response.dto.ts   — accessToken: string
  refresh-response.dto.ts — accessToken: string
  fcm-token.dto.ts        — token (IsString), deviceId (IsString)
repositories/
  auth.repository.ts
services/
  auth.service.ts
  auth.service.spec.ts
strategies/
  jwt.strategy.ts
guards/
  jwt-auth.guard.ts
controllers/
  auth.controller.ts
auth.module.ts
```

**`auth.repository.ts`** — Prisma-only: `findUserByEmail`, `findUserById`, `createUser`, `createRefreshToken(userId, tokenHash, expiresAt)`, `findRefreshToken(tokenHash)`, `deleteRefreshToken(tokenHash)`, `deleteAllUserRefreshTokens`, `upsertFcmToken` (via `userId_deviceId` compound unique), `deleteFcmToken`.

**`auth.service.ts`** — `hashToken()` = SHA-256 hex digest. `register` → `ConflictException` on duplicate email, `bcrypt.hash(password, 10)`, returns sanitized user. `login` → `UnauthorizedException` on bad email/password, signs access token (`{sub, email}`, `jwtSecret`, `15m`) and refresh token (`{sub}`, `jwtRefreshSecret`, `30d`), stores SHA-256 hash + expiry. `refresh` → verifies JWT signature, looks up hash, deletes old row, re-fetches user for `email`, issues + stores new pair (has a `// TODO:` for a Redis mutex on concurrent refresh, flagged as post-MVP hardening per user's explicit request). `logout` → deletes by hash. `registerFcmToken`/`removeFcmToken`/`getCurrentUser` are thin repository passthroughs (the latter with `NotFoundException` + sanitize).

**`jwt.strategy.ts`** — `PassportStrategy(Strategy, 'jwt')`, bearer extraction, `secretOrKey: appConfigService.jwtSecret`, `validate()` returns `{ id: payload.sub, email: payload.email }`.

**`jwt-auth.guard.ts`** — extends `AuthGuard('jwt')`, `Reflector`-based `@Public()` bypass via `getAllAndOverride`.

**`auth.controller.ts`** — all 8 routes. Cookie options (`httpOnly`, `secure: nodeEnv === 'production'`, `sameSite: 'strict'`, `maxAge: 30d`) built once via a private helper. `refresh`/`logout` read the cookie via a `readRefreshCookie()` helper; `refresh` throws `UnauthorizedException` if the cookie is missing, `logout` is a no-op-safe if it's already gone. `login`/`refresh`/`logout` use `@HttpCode(200)` (Nest's POST default is 201).

**`auth.module.ts`** — `imports: [PassportModule, JwtModule.register({})]` (no default secret; every call passes its own).

### `AppModule` / `main.ts`
- `AppModule` imports `AuthModule`, adds `{ provide: APP_GUARD, useClass: JwtAuthGuard }`.
- `main.ts` adds `app.use(cookieParser())` and `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))`.

### Tests
`auth.service.spec.ts` — register (happy + duplicate), login (happy + wrong password + unknown email), refresh (happy + invalid signature + reused token), logout. Mocks `AuthRepository`, `JwtService`, `AppConfigService`, `bcryptjs`. Explicitly asserts `signAsync`/`verifyAsync` are called with `{ secret, ... }` each time.

## Amendments applied during execution

1. **(Approved before execution)** Every `jwtService.signAsync()`/`verifyAsync()` call explicitly passes `{ secret, ... }` — confirmed by showing `login()` to the user before building the rest of the service.
2. **(Approved before execution)** `refresh()` carries a `// TODO:` noting the lack of a concurrent-refresh mutex (Redis lock is the intended post-MVP fix).
3. `auth.service.ts`'s `sanitize()` originally used `const { passwordHash: _passwordHash, ...sanitized } = user` to strip the password hash, which tripped `@typescript-eslint/no-unused-vars` (no `ignoreRestSiblings` configured in this repo's eslint config). Changed to a shallow-copy + `delete` instead — avoids both the lint error and any eslint config change.
4. `auth.controller.ts` imported `RequestWithCorrelation` as a named import alongside value imports from `@app/common`, which broke the build with `TS1272` (same class of error the shared-libs phase hit with `Response` — `isolatedModules` + `emitDecoratorMetadata` requires types used only in decorated parameter positions to be type-only imports). Split into a separate `import type` statement.
5. Added a scoped ESLint override (`files: ['**/*.spec.ts']`, `@typescript-eslint/unbound-method: 'off'`) — `expect(mock.method).toHaveBeenCalledWith(...)` is a well-known typescript-eslint false positive against Jest mocks of typed class methods (no `eslint-plugin-jest` in this repo to auto-remap the rule). Documented in `eslint.config.mjs` with a one-line comment.
6. After `npm install`ing the new packages, `docker compose up --build -d` alone left the container's anonymous `node_modules` volume stale (same issue as the shared-libs phase) — required `--renew-anon-volumes`. Named volumes (`postgres-data`, `redis-data`) were untouched, confirmed by seed data surviving.

## Verification results (actual)

1. `npm run lint` → 0 errors on auth-related files; only the 7 pre-existing, unrelated errors in `apps/reminder-worker/test/app.e2e-spec.ts` remain (same file flagged as pre-existing in the shared-libs phase).
2. `npm run test` → 3 suites / 11 tests passed.
3. `npm run build` → clean after the `import type` fix.
4. `docker compose up --build -d --renew-anon-volumes` → `taskplatform-api` healthy.
5. `POST /auth/register` → `201`, body has no `passwordHash`. Duplicate email → `409 CONFLICT`.
6. `POST /auth/login` → `200`, `{accessToken}` in body, `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict` (no `Secure` — `NODE_ENV=development`).
7. `GET /auth/me` with Bearer token → `200`, sanitized profile. Without token → `401 UNAUTHORIZED`.
8. `POST /auth/refresh` with cookie → `200`, new `accessToken` + new cookie. Reusing the old (already-rotated) cookie afterward → `401 "Refresh token already used or unknown"`, confirming rotation via the SHA-256 lookup hash.
9. `POST /auth/logout` → `200`, `Set-Cookie` clears the cookie (`Expires=Thu, 01 Jan 1970`).
10. `POST /auth/fcm-token` with Bearer + `{token, deviceId}` → `200`. `DELETE /auth/fcm-token/:deviceId` → `200`.
11. `GET /health` → `200 {"status":"ok"}`; `GET /ready` → `200 {"status":"ok","db":"ok","redis":"ok"}` — both still public after the global guard.
12. `GET /` → `200 "Hello World!"` — still public.
13. Extra: `POST /auth/register` with an unknown field (`isAdmin`) → `400 "property isAdmin should not exist"`, confirming `whitelist`/`forbidNonWhitelisted` is active.

Test user created during verification (`planner-test@example.com`) was deleted from the DB afterward (cascades to its refresh tokens / FCM tokens).
