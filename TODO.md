# NocoDB CLI — Status & Roadmap

## What's Done

### SDK (`packages/sdk/src/`)

28+ methods covering CRUD for core metadata and data endpoints, all with typed generics:

- **Bases** — list, create, get, getInfo, update, delete
- **Tables** — list, create, get, update, delete
- **Views** — list, create (v1 type-specific endpoints), get, update, delete
- **Filters** — list, create, get, update, delete
- **Sorts** — list, create, get, update, delete
- **Columns** — list, create, get, update, delete
- **Links** — listLinks, linkRecords, unlinkRecords (`DataApi`)
- **Hooks** — listHooks, createHook, getHook, updateHook, deleteHook, testHook
- **Sources** — listSources, createSource, getSource, updateSource, deleteSource
- **Tokens** — listTokens(baseId), createToken(baseId, body), deleteToken(baseId, tokenId) *(v2 base-scoped)*
- **Base Users** — listBaseUsers, inviteBaseUser, updateBaseUser, removeBaseUser
- **Swagger** — getBaseSwagger
- **Storage** — uploadAttachment
- **Schema** — introspectTable (returns full table schema with columns, primary key, display value, relations)
- **Pagination** — `NocoClient.fetchAllPages<T>()` auto-fetches all pages of any paginated endpoint
- **Low-level** — `NocoClient.request<T>()`, `parseHeader()`, `normalizeBaseUrl()`
- **Typed responses** — all methods use generics (e.g., `Promise<ListResponse<Base>>`, `Promise<Table>`)
- **Typed entities** — `Base`, `Source`, `SourceType`, `Table`, `View`, `Column`, `Filter`, `Sort`, `Row`, `Hook`, `ApiToken`, `BaseUser`, `ViewType`, `ColumnType`
- **Typed errors** — `AuthenticationError`, `NotFoundError`, `ConflictError`, `ValidationError`, `NetworkError`
- **Retry/timeout** — configurable via `RetryOptions` and `timeoutMs`

### CLI (`packages/cli/src/`)

70+ commands including:

- **Config** — `config set/get/show`
- **Headers** — `header set/delete/list`
- **Raw requests** — `request <method> <path>` with `--query`, `--header`, `--data`, `--data-file` options
- **Bases** — `bases list/get/info/create/update/delete`
- **Tables** — `tables list/get/create/update/delete`
- **Views** — `views list/get/create/update/delete` (create supports `--type grid|form|gallery|kanban|calendar`)
- **Filters** — `filters list/get/create/update/delete`
- **Sorts** — `sorts list/get/create/update/delete`
- **Columns** — `columns list/get/create/update/delete` (with JSON schema validation)
- **Rows** — `rows list/read/create/update/delete/upsert/bulk-create/bulk-update/bulk-upsert/bulk-delete` (with schema validation, `--match`, `--create-only`, `--update-only`, `--all` auto-paginate)
- **Links** — `links list/create/delete`
- **Storage** — `storage upload <filePath>`
- **Schema** — `schema introspect <tableId>` (discover columns, primary key, display value, relations)
- **Hooks** — `hooks list/get/create/update/delete/test` (webhook management)
- **Sources** — `sources list/get/create/update/delete` (data source management per base)
- **Tokens** — `tokens list/create/delete <baseId>` (base-scoped API token management, v2)
- **Users** — `users list/invite/update/remove` (base collaborator management)
- **Meta** — `meta swagger/endpoints/cache clear`
- **Dynamic API** — `--base <id> api <tag> <operation>` auto-generated from Swagger
- **Settings** — `settings show/path/set/reset` (timeout, retry count, retry delay, retry status codes)
- **Workspaces** — `workspace add/use/list/show/delete` (multi-account support)
- **Aliases** — `alias set/list/delete/clear` (friendly names for table IDs, namespaced by workspace)
- **Env var support** — `NOCO_TOKEN`, `NOCO_BASE_URL`, `NOCO_BASE_ID` override workspace config for CI/CD
- **Data I/O** — `data export <tableId>` (CSV/JSON, `--out`, `--format`, `--query`) and `data import <tableId> <file>` (CSV/JSON, auto-paginated export, batched import with swagger validation via RowService)
- **Output formats** — `--format json|csv|table` on all commands, `--pretty` for indented JSON
- **Verbose mode** — `--verbose` for request timing and retry logging
- **Error handling** — contextual HTTP error messages with status codes and response bodies

### Testing (32 test files, 729+ tests)

- Unit tests for config, headers, settings, and utility parsing
- Unit tests for MetaService, RowService, LinkService, StorageService, SwaggerService
- Unit tests for row upsert, bulk row, and bulk upsert command behavior
- E2E tests with mock HTTP servers for all CRUD commands (bases, tables, views, columns, filters, sorts, links, rows, request)
- E2E tests for workspace and alias management
- Performance tests
- Comprehensive live E2E suite (`scripts/e2e-cli.mjs`) covering 40+ column types, CRUD, link columns, attachments, swagger caching, schema introspection

### API Endpoint Notes

- Most endpoints use NocoDB v2 API (`/api/v2/meta/...`)
- **View creation** uses v1 API: `POST /api/v1/db/meta/tables/{tableId}/grids` (and `/forms`, `/galleries`, `/kanbans`, `/calendars`)
- The e2e script uses only CLI commands — no direct API calls

---

## What's Still Missing

### SDK Gaps

- ~~**No pagination helpers** — no cursor/offset wrappers for large result sets~~ ✅ Done
- ~~**No user/auth APIs** — no profile, token management, or invitation endpoints~~ ✅ SDK+CLI Done — `tokens list/create/delete`, `users list/invite/update/remove`, `me` ⚠️ e2e blocked: tokens requires session auth (401 with xc-token), users response format needs investigation
- ~~**No webhook/automation APIs** — no hook creation or management~~ ✅ SDK+CLI Done — `hooks list/get/create/update/delete/test` ⚠️ e2e blocked: hook v2 create returns 400 "deprecated / not supported" — needs v3 webhook API migration
- **No NocoDB workspace/org APIs** — no NocoDB-level workspace CRUD or member management (distinct from CLI workspaces)
- **No audit log APIs** — no activity or change tracking
- ~~**No export/import APIs** — no CSV/JSON export or import~~ ✅ Done (client-side via `data export` / `data import`)
- **No comment/collaboration APIs** — no discussion or @mention support

### CLI Gaps

- ~~**No `nocodb me`** — no quick way to verify auth/identity~~ ✅ Done
- ~~**No env var support for config** — no `NOCO_TOKEN`, `NOCO_BASE_URL` env vars for CI/CD~~ ✅ Done
- ~~**No help examples** — commands lack inline usage examples~~ ✅ Done
- ~~**No `--select` field filtering** — no way to pick specific fields from output~~ ✅ Done

---

## Easy Wins

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| 1 | ~~`nocodb me` command~~ | ~~~20 lines~~ | ~~Low~~ | ✅ Done — `nocodb me` calls `/api/v2/auth/user/me` |
| 2 | ~~Env var support for all config options~~ | ~~~30 lines~~ | ~~Medium~~ | ✅ Done — `NOCO_TOKEN`, `NOCO_BASE_URL`, `NOCO_BASE_ID` |
| 3 | ~~Pagination helpers (auto-fetch all pages)~~ | ~~~60 lines~~ | ~~Medium~~ | ✅ Done — `--all` flag + `fetchAllPages()` |
| 4 | ~~`--select` field filtering on output~~ | ~~~40 lines~~ | ~~Medium~~ | ✅ Done — `--select id,title` on all commands |
| 5 | ~~Inline help examples on commands~~ | ~~\~100 lines~~ | ~~Low~~ | ✅ Done — all commands have `addHelpText` examples |

---

## Architecture Notes

### Strengths

- Clean separation between SDK and CLI packages
- TypeScript throughout with fully typed SDK generics
- AJV schema validation for request bodies
- Dynamic command generation from Swagger specs
- Swagger caching with manual invalidation (`meta cache clear`)
- Multi-workspace support with per-workspace aliases
- Configurable retry/timeout with settings persistence
- Verbose mode for debugging (`--verbose`)
- Contextual error messages with HTTP status codes

### Weaknesses

- Swagger parsing assumes specific NocoDB path format
- No automatic cache invalidation strategy
- View creation requires v1 API (v2 doesn't support it)
- ~~No env var fallback for config~~ ✅ Fixed — `NOCO_TOKEN`, `NOCO_BASE_URL`, `NOCO_BASE_ID` supported

### Recent Fixes

- **Env var override** — `applyEnvVarOverrides` uses nullish coalescing (`??`) so empty-string env vars are treated as explicitly set
- **Data import validation** — `data import` now routes through `RowService` for swagger schema validation (consistent with `rows` commands)
- **Path traversal guards** — `data import` and `data export --out` validate file paths to prevent traversal (matching `--data-file` behavior)
- **CSV parser** — `parseCsv` no longer trims data rows, preserving whitespace-significant field values
- **Upsert duplicate detection** — `data import --match` uses `RowService.bulkUpsert` which properly detects duplicate match values

---

## API Gaps vs. v2 Meta OpenAPI Spec

Comparison of `openapi/v2/nocodb-meta-v2-openapi.json` against SDK (`packages/sdk`) and CLI (`packages/cli`).
Endpoints tagged `Internal` in the spec are noted but deprioritized.

---

### Gap 1: Sources (Data Sources) — ✅ DONE

**Status:** ~~Entirely missing from SDK, CLI, and types.~~ Implemented — types, SDK, CLI service, CLI commands, unit tests.

**What the spec defines:**
- `GET    /api/v2/meta/bases/{baseId}/sources/` — list sources
- `POST   /api/v2/meta/bases/{baseId}/sources/` — create source
- `GET    /api/v2/meta/bases/{baseId}/sources/{sourceId}` — read source
- `PATCH  /api/v2/meta/bases/{baseId}/sources/{sourceId}` — update source
- `DELETE /api/v2/meta/bases/{baseId}/sources/{sourceId}` — delete source

**Source entity fields (from spec):** `id`, `base_id`, `alias`, `config`, `enabled`, `inflection_column`, `inflection_table`, `is_meta`, `meta`, `order`, `type` (e.g. `mysql2`, `pg`, `sqlite3`), `created_at`, `updated_at`

**Plan:**
1. **Types** — Add `Source` interface to `packages/sdk/src/types/entities.ts`
2. **SDK** — Add to `MetaApi` class: `listSources(baseId)`, `createSource(baseId, body)`, `getSource(baseId, sourceId)`, `updateSource(baseId, sourceId, body)`, `deleteSource(baseId, sourceId)`
3. **CLI service** — Add matching methods to `MetaService`
4. **CLI commands** — New `sources list/get/create/update/delete` commands (follow `users.ts` pattern since they take `baseId` arg)
5. **Tests** — Unit tests for MetaService source methods, E2E tests with mock server

**Open questions:** None — straightforward CRUD, follows existing patterns exactly.

---

### Gap 2: API Tokens v1→v2 Migration — ✅ DONE

**Status:** ~~SDK uses `/api/v1/tokens` (global). Spec defines `/api/v2/meta/bases/{baseId}/api-tokens` (base-scoped).~~ Migrated — SDK, CLI service, CLI commands all use v2 base-scoped endpoints.

**What the spec defines:**
- `POST   /api/v2/meta/bases/{baseId}/api-tokens` — create token (PUBLIC)
- `DELETE /api/v2/meta/bases/{baseId}/api-tokens/{tokenId}` — delete token (PUBLIC)
- `GET    /api/v2/meta/bases/{baseId}/api-tokens` — list tokens (Internal, but needed)

**Key difference:** v2 tokens are scoped to a base (`baseId` required). v1 tokens are global.

**Plan:**
1. **SDK** — Update `MetaApi`: change `listTokens()` → `listTokens(baseId)`, `createToken(body)` → `createToken(baseId, body)`, `deleteToken(token)` → `deleteToken(baseId, tokenId)`. Note: delete key changes from token string to tokenId.
2. **CLI commands** — Update `tokens list/create/delete` to require `baseId` argument (like `users` commands)
3. **Backward compat** — Consider keeping v1 methods as `listTokensV1()` etc. if users need global token access
4. **Tests** — Update existing token tests to pass baseId

**Open questions:**
- Should we keep v1 token endpoints as fallback for self-hosted instances that may not support v2 tokens?
- Does the list endpoint actually work despite being tagged Internal?

---

### Gap 3: Comments — **MEDIUM PRIORITY**

**Status:** Entirely missing.

**What the spec defines:**
- `GET    /api/v2/meta/comments` — list comments (query params: `row_id`, `fk_model_id`)
- `POST   /api/v2/meta/comments` — create comment on a row
- `PATCH  /api/v2/meta/comment/{commentId}` — update comment
- `DELETE /api/v2/meta/comment/{commentId}` — delete comment

**Note:** The list endpoint uses query params `row_id` and `fk_model_id` (table ID) to scope comments to a specific row.

**Plan:**
1. **Types** — Add `Comment` interface: `id`, `row_id`, `fk_model_id`, `comment`, `created_by`, `created_by_email`, `resolved_by`, `created_at`, `updated_at`
2. **SDK** — Add to `MetaApi`: `listComments(tableId, rowId)`, `createComment(body)`, `updateComment(commentId, body)`, `deleteComment(commentId)`
3. **CLI commands** — New `comments list/create/update/delete` commands. `list` takes `--table-id` and `--row-id` options.
4. **Tests** — Unit + E2E

**Open questions:**
- Need to verify exact query param names for list endpoint (`row_id` vs `rowId`, `fk_model_id` vs `tableId`)

---

### Gap 4: Shared Views — **MEDIUM PRIORITY**

**Status:** Entirely missing.

**What the spec defines:**
- `GET    /api/v2/meta/tables/{tableId}/share` — list shared views for a table
- `POST   /api/v2/meta/views/{viewId}/share` — create shared view
- `PATCH  /api/v2/meta/views/{viewId}/share` — update shared view
- `DELETE /api/v2/meta/views/{viewId}/share` — delete shared view

**Plan:**
1. **Types** — Add `SharedView` interface: `id`, `fk_view_id`, `password`, `meta`, `created_at`, `updated_at`
2. **SDK** — Add to `MetaApi`: `listSharedViews(tableId)`, `createSharedView(viewId, body?)`, `updateSharedView(viewId, body)`, `deleteSharedView(viewId)`
3. **CLI commands** — New `shared-views list/create/update/delete` commands
4. **Tests** — Unit + E2E

**Open questions:** None — straightforward CRUD.

---

### Gap 5: Shared Base — **MEDIUM PRIORITY**

**Status:** Entirely missing.

**What the spec defines:**
- `GET    /api/v2/meta/bases/{baseId}/shared` — get shared base info (uuid, url, roles)
- `POST   /api/v2/meta/bases/{baseId}/shared` — create shared base (body: `{roles, password}`)
- `PATCH  /api/v2/meta/bases/{baseId}/shared` — update shared base
- `DELETE /api/v2/meta/bases/{baseId}/shared` — disable shared base

**Plan:**
1. **SDK** — Add to `MetaApi`: `getSharedBase(baseId)`, `createSharedBase(baseId, body)`, `updateSharedBase(baseId, body)`, `deleteSharedBase(baseId)`
2. **CLI commands** — Could be subcommands under `bases`: `bases share get/create/update/delete <baseId>`
3. **Tests** — Unit + E2E

**Open questions:** None.

---

### Gap 6: View-Type-Specific Endpoints — **MEDIUM PRIORITY**

**Status:** CLI `views create` uses v1 type-specific paths. SDK `createView` uses a generic v2 path that may not work.

**What the spec defines (v2 creation endpoints):**
- `POST /api/v2/meta/tables/{tableId}/grids` — create grid view
- `POST /api/v2/meta/tables/{tableId}/forms` — create form view
- `POST /api/v2/meta/tables/{tableId}/galleries` — create gallery view
- `POST /api/v2/meta/tables/{tableId}/kanbans` — create kanban view

**View-type-specific read/update:**
- `GET/PATCH /api/v2/meta/forms/{formViewId}` — form-specific config
- `GET/PATCH /api/v2/meta/galleries/{galleryViewId}` — gallery-specific config
- `GET/PATCH /api/v2/meta/kanbans/{kanbanViewId}` — kanban-specific config
- `PATCH /api/v2/meta/grids/{viewId}` — grid-specific config

**View column management:**
- `GET /api/v2/meta/views/{viewId}/columns` — list view columns (field visibility/order)
- `PATCH /api/v2/meta/grid-columns/{columnId}` — update grid column settings
- `PATCH /api/v2/meta/form-columns/{formViewColumnId}` — update form column settings

**Plan:**
1. **SDK** — Add type-specific creation: `createGridView(tableId, body)`, `createFormView(...)`, `createGalleryView(...)`, `createKanbanView(...)`. Add type-specific read/update: `getFormView(id)`, `updateFormView(id, body)`, etc. Add `listViewColumns(viewId)`.
2. **CLI** — Update `views create` to use v2 type-specific paths instead of v1. Add `views config get/update <viewId>` for type-specific settings. Add `views columns list <viewId>`.
3. **Tests** — Update existing view creation tests

**Open questions:**
- Should `views create --type grid` dispatch to `/grids` automatically, or should we have separate `views create-grid`, `views create-form` etc.?
- The generic `POST /api/v2/meta/tables/{tableId}/views` path doesn't exist in the v2 spec — need to confirm the current SDK `createView` actually works.

---

### Gap 7: Filter Children (Nested Filter Groups) — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `GET /api/v2/meta/filters/{filterGroupId}/children` — list child filters of a filter group

**Plan:**
1. **SDK** — Add `listFilterChildren(filterGroupId)` to `MetaApi`
2. **CLI** — Add `filters children <filterGroupId>` command
3. **Tests** — Unit + E2E

**Open questions:** None — single endpoint.

---

### Gap 8: Hook Filters — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `GET  /api/v2/meta/hooks/{hookId}/filters` — list filters for a hook
- `POST /api/v2/meta/hooks/{hookId}/filters` — create filter for a hook

**Plan:**
1. **SDK** — Add `listHookFilters(hookId)`, `createHookFilter(hookId, body)` to `MetaApi`
2. **CLI** — Add `hooks filters list/create <hookId>` subcommands
3. **Tests** — Unit + E2E

**Open questions:** None.

---

### Gap 9: Column: Set Primary — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `POST /api/v2/meta/columns/{columnId}/primary` — set a column as the primary/display column

**Plan:**
1. **SDK** — Add `setColumnPrimary(columnId)` to `MetaApi`
2. **CLI** — Add `columns set-primary <columnId>` command
3. **Tests** — Unit + E2E

**Open questions:** None — single POST with no body.

---

### Gap 10: Duplicate Operations — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `POST /api/v2/meta/duplicate/{baseId}` — duplicate a base
- `POST /api/v2/meta/duplicate/{baseId}/{sourceId}` — duplicate a base source
- `POST /api/v2/meta/duplicate/{baseId}/table/{tableId}` — duplicate a table

**Body options:** `{ options: { excludeData, excludeViews, excludeHooks } }`

**Plan:**
1. **SDK** — Add `duplicateBase(baseId, options?)`, `duplicateSource(baseId, sourceId, options?)`, `duplicateTable(baseId, tableId, options?)` to `MetaApi`
2. **CLI** — Add `bases duplicate <baseId>`, `tables duplicate <baseId> <tableId>` with `--exclude-data`, `--exclude-views`, `--exclude-hooks` flags
3. **Tests** — Unit + E2E

**Open questions:** None.

---

### Gap 11: Visibility Rules (UI ACL) — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `GET  /api/v2/meta/bases/{baseId}/visibility-rules` — get view visibility by role
- `POST /api/v2/meta/bases/{baseId}/visibility-rules` — set view visibility by role

**Plan:**
1. **SDK** — Add `getVisibilityRules(baseId)`, `setVisibilityRules(baseId, body)` to `MetaApi`
2. **CLI** — Add `bases visibility get/set <baseId>` commands
3. **Tests** — Unit + E2E

**Open questions:** Need to verify the request body schema for `VisibilityRuleReq`.

---

### Gap 12: App Info — **LOW PRIORITY**

**Status:** Missing.

**What the spec defines:**
- `GET /api/v2/meta/nocodb/info` — get NocoDB server info (version, etc.)

**Plan:**
1. **SDK** — Add `getAppInfo()` to `MetaApi`
2. **CLI** — Add `info` command (or `meta info`)
3. **Tests** — Unit + E2E

**Open questions:** None — single GET.

---

### Gap 13: Auth APIs — **DEPRIORITIZED** (quick fix ✅)

**Status:** Mostly missing. ~~The `me` command currently uses v1 path (`/api/v1/auth/user/me`).~~ `me` command updated to v2 path.

**What the spec defines:**
- `POST /api/v2/auth/user/signup` — sign up
- `POST /api/v2/auth/user/signin` — sign in (returns JWT)
- `POST /api/v2/auth/user/signout` — sign out
- `GET  /api/v2/auth/user/me` — get current user info
- `POST /api/v2/auth/password/forgot` — forgot password
- `POST /api/v2/auth/password/change` — change password
- `POST /api/v2/auth/password/reset/{token}` — reset password
- `POST /api/v2/auth/token/validate/{token}` — validate reset token
- `POST /api/v2/auth/email/validate/{token}` — validate email
- `POST /api/v2/auth/token/refresh` — refresh JWT token
- `PATCH /api/v2/meta/user/profile` — update user profile

**Plan:**
1. **SDK** — New `AuthApi` class (separate from `MetaApi`): `signup(body)`, `signin(body)`, `signout()`, `me()`, `forgotPassword(body)`, `changePassword(body)`, `resetPassword(token, body)`, `validateResetToken(token)`, `validateEmail(token)`, `refreshToken()`, `updateProfile(body)`
2. **CLI** — Update `me` command to use v2 path. Add `auth signin/signout/change-password` commands. Skip signup/forgot/reset (not useful for CLI).
3. **Immediate fix** — Update `me.ts` from `/api/v1/auth/user/me` → `/api/v2/auth/user/me`

**Why deprioritized:** CLI primarily uses API tokens (`xc-token`), not JWT auth. Most auth endpoints (signup, forgot password, email validation) aren't relevant for CLI usage. The `me` v1→v2 path fix is a quick win though.

**Open questions:**
- Should `auth signin` store the JWT in workspace config for session-based workflows?
- Is there value in `auth signup` from CLI (e.g., for scripted provisioning)?

---

### Gap 14: Workspace APIs (Cloud-only ☁) — **DEPRIORITIZED**

**Status:** Missing. Note: these are NocoDB Cloud workspace APIs, distinct from the CLI's local workspace management.

**What the spec defines:**
- `GET/POST /api/v2/meta/workspaces` — list/create workspaces
- `GET/PATCH/DELETE /api/v2/meta/workspaces/{workspaceId}` — CRUD workspace
- `GET /api/v2/meta/workspaces/{workspaceId}/users` — list workspace users
- `POST /api/v2/meta/workspaces/{workspaceId}/invitations` — invite user
- `GET/PATCH/DELETE /api/v2/meta/workspaces/{workspaceId}/users/{userId}` — user CRUD
- `GET/POST /api/v2/meta/workspaces/{workspaceId}/bases` — list/create bases in workspace

**Why deprioritized:** All marked with ☁ (cloud-only). Self-hosted NocoDB doesn't have workspaces. Would cause confusion with CLI's existing `workspace` command (local multi-account management).

**Plan (if needed later):**
1. **SDK** — New `WorkspaceApi` class with full CRUD
2. **CLI** — New `cloud-workspace` or `noco-workspace` command group to avoid collision with existing `workspace` command
3. **Tests** — Unit + E2E with mock

**Open questions:**
- How to disambiguate from CLI's local `workspace` command?
- Should this only be enabled when connected to `app.nocodb.com`?

---

### Gap 15: Base Type Incomplete — ✅ DONE

**Status:** ~~`Base` interface missing many fields the API actually returns.~~ Expanded with all optional fields + `Source` interface added.

**Missing fields:** `color`, `description`, `deleted`, `meta`, `order`, `prefix`, `status`, `sources` (array of Source), `external`

**Plan:**
1. **Types** — Expand `Base` interface in `entities.ts` with optional fields
2. No SDK/CLI changes needed — the fields are already returned by the API, they're just not typed

**Open questions:** None — additive change, all new fields optional.

---

### Implementation Priority Order

| Priority | Gap | Effort | Notes |
|----------|-----|--------|-------|
| ✅ Done | #15 Base type | ~10 lines | Added missing optional fields + Source type |
| ✅ Done | #13 `me` v1→v2 | ~1 line | Changed path in `me.ts` |
| ✅ Done | #1 Sources | ~200 lines | Full CRUD — types, SDK, CLI service, commands, tests |
| ✅ Done | #2 Tokens v1→v2 | ~80 lines | Breaking change — tokens now base-scoped |
| 🟡 Medium | #3 Comments | ~150 lines | New entity + CRUD |
| 🟡 Medium | #4 Shared Views | ~120 lines | New entity + CRUD |
| 🟡 Medium | #5 Shared Base | ~80 lines | 4 endpoints under bases |
| 🟡 Medium | #6 View-type endpoints | ~250 lines | Largest change, touches existing code |
| 🟢 Low | #7 Filter Children | ~30 lines | Single endpoint |
| 🟢 Low | #8 Hook Filters | ~50 lines | 2 endpoints |
| 🟢 Low | #9 Set Primary Column | ~30 lines | Single endpoint |
| 🟢 Low | #10 Duplicate Ops | ~80 lines | 3 endpoints |
| 🟢 Low | #11 Visibility Rules | ~50 lines | 2 endpoints |
| 🟢 Low | #12 App Info | ~30 lines | Single endpoint |
| ⚪ Deferred | #13 Full Auth | ~300 lines | Not critical for CLI token-based usage |
| ⚪ Deferred | #14 Cloud Workspaces | ~250 lines | Cloud-only, naming collision risk |
