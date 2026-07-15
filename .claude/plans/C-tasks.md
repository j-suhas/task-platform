# Workspace + Project + Task CRUD + Board + Backlog

## Context

Auth is complete (`apps/task-platform/src/modules/auth/`) with a global `JwtAuthGuard` (`@Public()` opt-out) already wired into `AppModule`, so `req.user = { id, email }` is available on every protected route via `@CurrentUser()`. The Prisma schema already has `User`, `Workspace`, `WorkspaceMember`, `Project`, `Task`, `Sprint` models — this phase is pure application code, no migration needed. Goal: stand up four new modules (Users, Workspaces, Projects, Tasks) following the existing `controllers/ → services/ → repositories/ → dto/` layout used by `modules/auth/`, giving the frontend (later phase) a working task board + backlog API.

**Gap found in the literal spec, resolved with user before planning:** the Tasks section of the spec never verified workspace/project membership (unlike Workspaces/Projects, which explicitly check on every method), and `/tasks/:id` has no `workspaceId` in its URL to hang a guard off of. Left as-is, any authenticated user could read/edit/delete any task by UUID regardless of workspace — an IDOR gap. **Confirmed with user: enforce membership in the service layer** — `TasksService` resolves `task/project → workspaceId` and checks `WorkspaceMember` before every read/write, mirroring `ProjectsService`'s intent.

**Other gaps filled vs. the literal spec (mechanical, no behavior ambiguity):**
- `WorkspacesService.invite` needed a "find user by email" lookup not present on `WorkspacesRepository` — `WorkspacesModule` imports `UsersModule` and injects `UsersRepository` instead of duplicating that lookup. `TasksService` does the same for assignee-exists checks.
- The spec put `WorkspaceMemberGuard` only on invite/members routes, then separately had the service re-verify membership. Applied the guard uniformly to all three `:workspaceId`-scoped workspace routes (including `GET /workspaces/:workspaceId`) and to every Projects route, so services only do not-found lookups, not duplicate authorization.
- Route param names (`:id`/`:wId` in the spec's pseudocode) are internal `@Param()` keys only, invisible to API clients — standardized on `@Param('workspaceId')` / `@Param('projectId')` everywhere.
- `TaskStatus` has a 5th value (`SNOOZED`, reminder-driven, out of scope) — `getBoardView` groups into exactly the spec's 4 keys; nothing sets `SNOOZED` this phase so it never appears.
- The spec's two Tasks route groups (`/projects/:projectId/tasks...` and `/tasks/:id...`) don't actually collide (different path prefixes), so no route-ordering workaround was needed — implemented as two controllers (`ProjectTasksController`, `TasksController`) in one module.
- `@nestjs/mapped-types` (for `PartialType`) wasn't installed — added as a new dependency.

## Dependencies installed

`npm install @nestjs/mapped-types` (`class-validator`/`class-transformer` were already present from the auth phase).

## File plan (as executed)

### `apps/task-platform/src/modules/users/`
```
repositories/users.repository.ts   — findById, findByEmail, updateUser
dto/update-user.dto.ts             — name?, digestTime? (HH:mm regex), timezone?
services/users.service.ts          — getProfile / updateProfile, NotFoundException + passwordHash strip
controllers/users.controller.ts    — GET/PATCH /users/me
users.module.ts                    — exports UsersRepository
```
Note: `AuthController` already has `GET /auth/me` doing the same lookup (from the auth phase). Left untouched since the auth module wasn't in scope — small intentional duplication with the new `/users/me`, not a bug.

### `apps/task-platform/src/modules/workspaces/`
```
repositories/workspaces.repository.ts — create (transaction: Workspace + OWNER member), findAllForUser,
                                         findById, findMember, addMember, findMembers (includes safe user fields)
guards/workspace-member.guard.ts      — reads params.workspaceId + user.id, ForbiddenException if not a member
dto/create-workspace.dto.ts, invite-member.dto.ts
services/workspaces.service.ts        — create, findAll, findOne, invite (UsersRepository.findByEmail →
                                         NotFoundException; findMember → ConflictException; addMember MEMBER), getMembers
controllers/workspaces.controller.ts  — POST/GET /workspaces (unguarded, scoped to caller);
                                         GET/POST/GET :workspaceId, :workspaceId/invite, :workspaceId/members (guarded)
workspaces.module.ts                  — imports UsersModule; exports WorkspacesRepository + WorkspaceMemberGuard
```

### `apps/task-platform/src/modules/projects/`
```
repositories/projects.repository.ts — create, findAll, findById, update, delete
dto/create-project.dto.ts, update-project.dto.ts (PartialType)
services/projects.service.ts        — create, findAll, findOne (NotFoundException on missing or
                                       workspaceId mismatch), update/remove (findOne first)
controllers/projects.controller.ts  — @Controller('workspaces/:workspaceId/projects'), all 5 routes
                                       behind WorkspaceMemberGuard (imported, not duplicated)
projects.module.ts                  — imports WorkspacesModule; exports ProjectsRepository
```

### `apps/task-platform/src/modules/tasks/`
```
repositories/tasks.repository.ts       — create, findAll(projectId, {status, assigneeId, tag, search}),
                                          findById, findBacklog, update, delete, updateStatus, updateAssignee
dto/linked-url.dto.ts, create-task.dto.ts, update-task.dto.ts (PartialType),
    update-status.dto.ts, assign-task.dto.ts
services/tasks.service.ts              — assertProjectMembership / assertTaskMembership private helpers
                                          (the approved authorization fix), then create/findAll/getBoardView/
                                          getBacklog/findOne/update/remove/updateStatus/assign
controllers/project-tasks.controller.ts — @Controller('projects/:projectId/tasks'): POST/GET/board/backlog
controllers/tasks.controller.ts         — @Controller('tasks'): GET/PATCH/DELETE :id, PATCH :id/status, :id/assign
tasks.module.ts                        — imports ProjectsModule, WorkspacesModule, UsersModule
```

**`tasks.service.ts`** — `assertTaskMembership` carries `// TODO: optimize with single JOIN query post-MVP if latency becomes noticeable (currently 3 sequential DB calls)`, added per user request during plan approval. `linkedUrls` cast to `Prisma.InputJsonValue` when passed to the repository (Prisma's `Json` field type doesn't structurally accept the DTO class directly). Repository `create`/`update` typed against `Prisma.TaskUncheckedCreateInput`/`TaskUncheckedUpdateInput` (not the relation-based `TaskCreateInput`) so raw scalar FKs like `projectId`/`assigneeId` type-check.

### `AppModule`
Imports `UsersModule, WorkspacesModule, ProjectsModule, TasksModule` alongside the existing `CommonModule, AuthModule`.

### Tests
- `tasks.service.spec.ts` — create (happy, project not found, assignee not found, not-a-member → Forbidden), getBoardView (grouping), findOne (found, not found, not-a-member → Forbidden), updateStatus, assign (valid, assignee not found). Mocks `TasksRepository`/`ProjectsRepository`/`WorkspacesRepository`/`UsersRepository`.
- `workspaces.service.spec.ts` — create, invite (happy, user not found, already a member). Mocks `WorkspacesRepository`/`UsersRepository`.

## Amendments applied during execution

1. **(Approved before execution)** Task-level authorization enforced in the service layer via `assertProjectMembership`/`assertTaskMembership`, closing the IDOR gap described in Context.
2. **(Approved before execution)** `assertTaskMembership` carries the 3-sequential-DB-calls `// TODO` comment per explicit user request at plan approval.
3. Removed a stray `@UseGuards(ProjectMemberGuard)` I'd mistakenly added to `project-tasks.controller.ts` referencing a guard that was never part of the plan — membership is enforced in `TasksService`, not a controller guard, per decision #1.
4. Dropped the `priority?: Priority = Priority.MEDIUM` class-field default on `CreateTaskDto` — `main.ts`'s global `ValidationPipe` doesn't set `transform: true`, so class defaults never reach the controller; the Prisma schema's own `@default(MEDIUM)` already covers the omitted-field case.
5. `eslint --fix` caught one unused import (`TaskStatus` in `tasks.service.ts`, left over after a cast it no longer needed) — removed.
6. Fixed a flaky-by-construction assertion in two `tasks.service.spec.ts` tests (`create` happy path, `findOne` happy path) that called `makeTask()` twice and compared two separately-constructed `Date` objects with `toEqual` — captured a single instance and compared against it instead.

## Verification results (actual)

1. `npm run build` → clean.
2. `npm run lint` → 0 errors on new files; only the same 7 pre-existing, unrelated errors in `apps/reminder-worker/test/app.e2e-spec.ts` (documented in the auth phase's log) remain.
3. `npm run test` → 5 suites / 27 tests passed.
4. `docker compose up --build -d --renew-anon-volumes` → all 4 containers healthy (Docker Desktop had to be started first; it wasn't running).
5. `POST /workspaces {name:"Family"}` → `201`. `GET /workspaces` → array with it.
6. `POST /workspaces/:id/invite` happy path → `201`; unknown email → `404 NOT_FOUND`; already-member → `409 CONFLICT`. `GET /workspaces/:id/members` → both members with safe user fields (no `passwordHash`).
7. `GET /workspaces/:id` as a non-member (second registered user) → `403 FORBIDDEN`.
8. `POST /workspaces/:wId/projects {name:"Personal"}` → `201`; `GET` lists it; `PATCH` updates `description`.
9. `POST /projects/:pId/tasks` with full anatomy (`tags`, `linkedUrls`, `priority`, `dueDate`) → `201`, all fields round-tripped correctly (including nested `linkedUrls` JSON).
10. `GET /projects/:pId/tasks/board` → `{TODO:[...],IN_PROGRESS:[],BLOCKED:[],DONE:[]}` shape confirmed.
11. `GET /projects/:pId/tasks/backlog` → tasks with no sprint.
12. Query filters verified individually: `?status=IN_PROGRESS`, `?tag=errand`, `?search=grocer` each correctly matched/excluded tasks.
13. `PATCH /tasks/:id/status` → `200`, status updated. `PATCH /tasks/:id/assign` → `200`, assignee set.
14. `GET /tasks/:id` → full detail; `DELETE /tasks/:id` → `200`.
15. **`GET /tasks/:id` as a non-member of the task's workspace → `403 FORBIDDEN`** — confirms the approved IDOR fix is live (this check isn't in the original spec's verification list; added specifically to prove the fix).
16. `GET /users/me` → sanitized profile; `PATCH /users/me {timezone:...}` → updated profile, no `passwordHash` in either response.

All test users/workspaces created during verification were deleted from the DB afterward (`Workspace` delete cascades to `Project`/`Task`; deleted the workspace before the users since `Task.creatorId`/`assigneeId` don't cascade). `docker compose down` afterward.

## Round 2 — code review fixes

A code review of the initial implementation raised two points, both addressed:

1. **Unvalidated query params reaching Prisma** — `ProjectTasksController.findAll` took `status`/`assigneeId`/`tag`/`search` as individual `@Query()` primitives typed as `TaskStatus`/`string`, but query params always arrive as raw strings with no coercion, so an invalid `status` value would flow straight through to `where.status` in `TasksRepository.findAll` and only fail once Prisma rejected it. Added `dto/list-tasks-query.dto.ts` (`ListTasksQueryDto`, `@IsEnum(TaskStatus)`/`@IsUUID()`/`@IsString()`, all `@IsOptional()`) and changed the controller to `@Query() query: ListTasksQueryDto`, so `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`, already global in `main.ts`) rejects bad values with a `400` at the controller boundary instead of letting them reach the data layer.
2. **No way to unassign a task** — `AssignTaskDto.assigneeId` and `TasksRepository.updateAssignee` only accepted a non-null UUID, so `PATCH /tasks/:id/assign` could set an assignee but never clear one. Changed `AssignTaskDto.assigneeId` to `string | null` with `@ValidateIf((_, value) => value !== null) @IsUUID()` (requires the field, allows explicit `null`, still validates non-null values as UUIDs), `TasksRepository.updateAssignee`'s signature to `string | null`, and `TasksService.assign` to skip the assignee-exists check when `assigneeId` is `null`. Added a corresponding unit test (`unassigns a task when assigneeId is null, without checking user existence`).

### Round 2 re-verification

1. `npm run build` → clean.
2. `npm run lint` → still only the same 7 pre-existing, unrelated `reminder-worker` errors.
3. `npm run test` → 5 suites / **28** tests passed (added the unassign case).
4. `docker compose up --build -d` → healthy.
5. Live smoke test: `?status=TODO` → `200` with the matching task; `?status=NOT_A_STATUS` → `400 BAD_REQUEST` (`"status must be one of the following values: TODO, IN_PROGRESS, BLOCKED, SNOOZED, DONE"`), confirming invalid enum values are now rejected before reaching Prisma. `?bogus=1` → `400` (`"property bogus should not exist"`), confirming `forbidNonWhitelisted` also covers the new query DTO. `PATCH /tasks/:id/assign {assigneeId: <uuid>}` → `200`, assigned; `{assigneeId: null}` → `200`, unassigned (`assigneeId: null` in the response); `{assigneeId: "not-a-uuid"}` → `400 "assigneeId must be a UUID"`. Test user (`review-fix-test@example.com`) and its workspace deleted afterward.
