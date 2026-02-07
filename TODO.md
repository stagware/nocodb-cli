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
- **Swagger** — getBaseSwagger
- **Storage** — uploadAttachment
- **Schema** — introspectTable (returns full table schema with columns, primary key, display value, relations)
- **Pagination** — `NocoClient.fetchAllPages<T>()` auto-fetches all pages of any paginated endpoint
- **Low-level** — `NocoClient.request<T>()`, `parseHeader()`, `normalizeBaseUrl()`
- **Typed responses** — all methods use generics (e.g., `Promise<ListResponse<Base>>`, `Promise<Table>`)
- **Typed entities** — `Base`, `Table`, `View`, `Column`, `Filter`, `Sort`, `Row`, `ViewType`, `ColumnType`
- **Typed errors** — `AuthenticationError`, `NotFoundError`, `ConflictError`, `ValidationError`, `NetworkError`
- **Retry/timeout** — configurable via `RetryOptions` and `timeoutMs`

### CLI (`packages/cli/src/`)

60+ commands including:

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
- **No user/auth APIs** — no profile, token management, or invitation endpoints
- **No webhook/automation APIs** — no hook creation or management
- **No NocoDB workspace/org APIs** — no NocoDB-level workspace CRUD or member management (distinct from CLI workspaces)
- **No audit log APIs** — no activity or change tracking
- ~~**No export/import APIs** — no CSV/JSON export or import~~ ✅ Done (client-side via `data export` / `data import`)
- **No comment/collaboration APIs** — no discussion or @mention support

### CLI Gaps

- ~~**No `nocodb me`** — no quick way to verify auth/identity~~ ✅ Done
- ~~**No env var support for config** — no `NOCO_TOKEN`, `NOCO_BASE_URL` env vars for CI/CD~~ ✅ Done
- **No help examples** — commands lack inline usage examples
- ~~**No `--select` field filtering** — no way to pick specific fields from output~~ ✅ Done

---

## Easy Wins

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| 1 | ~~`nocodb me` command~~ | ~~~20 lines~~ | ~~Low~~ | ✅ Done — `nocodb me` calls `/api/v1/auth/user/me` |
| 2 | ~~Env var support for all config options~~ | ~~~30 lines~~ | ~~Medium~~ | ✅ Done — `NOCO_TOKEN`, `NOCO_BASE_URL`, `NOCO_BASE_ID` |
| 3 | ~~Pagination helpers (auto-fetch all pages)~~ | ~~~60 lines~~ | ~~Medium~~ | ✅ Done — `--all` flag + `fetchAllPages()` |
| 4 | ~~`--select` field filtering on output~~ | ~~~40 lines~~ | ~~Medium~~ | ✅ Done — `--select id,title` on all commands |
| 5 | Inline help examples on commands | ~100 lines | Low | Better developer experience |

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
