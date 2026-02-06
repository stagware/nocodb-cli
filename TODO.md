# NocoDB CLI — Status & Roadmap

## What's Done

### SDK (`packages/sdk/src/index.ts`)

25 methods covering CRUD for core metadata endpoints:

- **Bases** — list, create, get, getInfo, update, delete
- **Tables** — list, create, get, update, delete
- **Views** — list, create, get, update, delete
- **Filters** — list, create, get, update, delete
- **Sorts** — list, create, get, update, delete
- **Columns** — list, create, get, update, delete
- **Swagger** — getBaseSwagger
- **Storage** — uploadAttachment
- **Low-level** — `NocoClient.request()`, `parseHeader()`, `normalizeBaseUrl()`

### CLI (`packages/cli/src/index.ts`)

50+ commands including:

- **Config** — `config set/get/show`
- **Headers** — `header set/delete/list`
- **Raw requests** — `request <method> <path>` with `-q`, `-H`, `-d`, `-f` options
- **Bases** — `bases list/get/info/create/update/delete`
- **Tables** — `tables list/get/create/update/delete`
- **Views** — `views list/get/create/update/delete`
- **Filters** — `filters list/get/create/update/delete`
- **Sorts** — `sorts list/get/create/update/delete`
- **Columns** — `columns list/get/create/update/delete` (with JSON schema validation)
- **Rows** — `rows list/read/create/update/delete/upsert` (with schema validation)
- **Storage** — `storage upload <filePath>`
- **Meta** — `meta swagger/endpoints/cache clear`
- **Dynamic API** — `--base <id> api <tag> <operation>` auto-generated from Swagger
- **Output formats** — `--format json|csv|table` on all commands, `--pretty` for indented JSON

### Testing

- Unit tests for config, headers, and utility parsing
- Unit tests for row upsert command behavior (`rows-upsert.test.ts`)
- SDK client unit tests
- Comprehensive E2E suite (`scripts/e2e-cli.mjs`) covering 40+ column types, CRUD, link columns, attachments, swagger caching

---

## What's Missing

### SDK Gaps

- **Untyped responses** — all methods return `Promise<unknown>`, no typed generics
- **No pagination helpers** — no cursor/offset wrappers for large result sets
- ~~**No retry/timeout logic** — single-shot requests only~~ ✅ Done (settings file + CLI flags)
- **No bulk row operations** — NocoDB supports batch create/update/delete natively
- ~~**No link record CRUD** — can create link *columns* but can't list/create/delete linked *records*~~ ✅ Done
- ~~**No attachment upload** — code exists in E2E tests but not exposed in SDK~~ ✅ Done
- **No user/auth APIs** — no profile, token management, or invitation endpoints
- **No webhook/automation APIs** — no hook creation or management
- **No workspace/org APIs** — no workspace CRUD or member management
- **No audit log APIs** — no activity or change tracking
- **No export/import APIs** — no CSV/JSON export or import
- **No comment/collaboration APIs** — no discussion or @mention support

### CLI Gaps

- ~~**No attachment command** — `nocodb attachments upload` (code already in E2E)~~ ✅ Done (`storage upload`)
- **No bulk row commands** — `rows bulk-create`, `rows bulk-update`
- ~~**No link record commands** — `links list/create/delete`~~ ✅ Done
- ~~**No output format options** — no `--format csv|table|yaml` or `--select` for field filtering~~ ✅ Done (`--format json|csv|table`)
- **No `nocodb me`** — no quick way to verify auth/identity
- **No workspace/org commands**
- **No help examples** — commands lack inline usage examples

---

## Easy Wins

| # | Feature | Effort | Impact | Notes |
|---|---------|--------|--------|-------|
| ~~1~~ | ~~Expose attachment upload as CLI command~~ | | | ✅ Done |
| ~~2~~ | ~~Add `--format` output option (json/csv/table)~~ | | | ✅ Done |
| ~~3~~ | ~~Better error messages with context wrapping~~ | | | ✅ Done |
| 4 | Typed SDK responses (generics on return types) | ~50 lines | Medium | Type safety across the board |
| 5 | Bulk row operations from file input | ~80 lines | High | Power-user feature, NocoDB supports natively |
| ~~6~~ | ~~Link record management commands~~ | | | ✅ Done |
| 7 | `nocodb me` command | ~20 lines | Low | Quick auth sanity check |
| 8 | Env var support for all config options | ~30 lines | Medium | CI/CD friendliness (`NOCO_TOKEN`, `NOCO_BASE_ID`) |

---

## Architecture Notes

### Strengths

- Clean separation between SDK and CLI packages
- TypeScript throughout
- AJV schema validation for request bodies
- Dynamic command generation from Swagger specs
- Swagger caching with manual invalidation (`meta cache clear`)

### Weaknesses

- SDK returns untyped `Promise<unknown>` everywhere
- No request logging or debug mode
- Config is minimal (baseUrl, baseId, headers only)
- Swagger parsing assumes specific NocoDB path format
- No automatic cache invalidation strategy
