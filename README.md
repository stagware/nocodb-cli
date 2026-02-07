# nocodb-cli

A Node.js + TypeScript SDK and CLI for NocoDB v2 APIs.

## Setup

```sh
npm install
```

Build packages before running the CLI locally:

```sh
npm run build
```

## Workspaces (Multi-Account Support)

Workspaces allow you to manage multiple NocoDB instances or bases with distinct URLs, tokens, and default Base IDs.

```sh
# Add a workspace
nocodb workspace add work https://noco.company.com <token> --base <baseId>
nocodb workspace add personal https://noco.me.com <token>

# Switch context
nocodb workspace use work
nocodb workspace list     # show all workspaces, active marked with *
nocodb workspace show     # show current workspace config
```

## Aliases (Namespaced IDs)

Aliases allow you to use friendly names instead of UUIDs. They are namespaced by workspace.

```sh
# Set aliases in the active workspace
nocodb alias set tasks <tableId>
nocodb alias set prayer <tableId>

# Usage (Current Workspace)
nocodb rows list tasks

# Usage (Cross-Workspace / Explicit)
nocodb rows list work.tasks
nocodb rows list personal.tasks

# Base Resolution
# If a workspace name is used where a Base ID is expected, it resolves to that workspace's default base.
nocodb tables list personal

# Management
nocodb alias list         # list aliases for active workspace
nocodb alias list personal # list aliases for specific workspace
nocodb alias delete tasks
nocodb alias clear        # clear all aliases for active workspace
```

## Environment Variables

For CI/CD pipelines or ephemeral environments, you can configure the CLI entirely via environment variables. These override workspace config but are overridden by CLI flags.

| Variable | Description |
|----------|-------------|
| `NOCO_BASE_URL` | NocoDB instance URL (e.g., `https://app.nocodb.com`) |
| `NOCO_TOKEN` | API token (sets the `xc-token` header) |
| `NOCO_BASE_ID` | Default base ID |

```sh
# Bash
export NOCO_BASE_URL=https://app.nocodb.com
export NOCO_TOKEN=your-api-token
export NOCO_BASE_ID=p_abc123
nocodb bases list

# PowerShell
$env:NOCO_BASE_URL="https://app.nocodb.com"
$env:NOCO_TOKEN="your-api-token"
$env:NOCO_BASE_ID="p_abc123"
nocodb bases list
```

If no workspace is configured, the CLI creates an ephemeral workspace from env vars (requires at minimum `NOCO_BASE_URL`).

## Configure (Legacy/Global)

These settings act as fallbacks if no workspace is active.

```sh
nocodb config set baseUrl http://localhost:8080
nocodb config set baseId <baseId>
nocodb header set xc-token <token>
```

## Bases

```sh
nocodb bases list
nocodb bases get <baseId>
nocodb bases info <baseId>
nocodb bases create --data '{"title":"My Base"}'
nocodb bases update <baseId> --data '{"title":"New Name"}'
nocodb bases delete <baseId>
```

## Tables

```sh
nocodb tables list <baseId>
nocodb tables get <tableId>
nocodb tables create <baseId> --data '{"table_name":"MyTable"}'
nocodb tables update <tableId> --data '{"table_name":"NewName"}'
nocodb tables delete <tableId>
```

## Views

```sh
nocodb views list <tableId>
nocodb views get <tableId> <viewId>
nocodb views create <tableId> --data '{"title":"Grid"}'
nocodb views create <tableId> --type form --data '{"title":"My Form"}'
nocodb views update <viewId> --data '{"title":"New View"}'
nocodb views delete <viewId>
```

Supported `--type` values: `grid` (default), `form`, `gallery`, `kanban`, `calendar`.

> **Note:** View creation uses the NocoDB v1 API (`/api/v1/db/meta/tables/{id}/grids` etc.) because the v2 endpoint does not support it.

## Filters

```sh
nocodb filters list <viewId>
nocodb filters get <filterId>
nocodb filters create <viewId> --data '{"field":"Name","op":"eq","value":"A"}'
nocodb filters update <filterId> --data '{"value":"B"}'
nocodb filters delete <filterId>
```

## Sorts

```sh
nocodb sorts list <viewId>
nocodb sorts get <sortId>
nocodb sorts create <viewId> --data '{"field":"Name","direction":"asc"}'
nocodb sorts update <sortId> --data '{"direction":"desc"}'
nocodb sorts delete <sortId>
```

## Columns

```sh
nocodb columns list <tableId>
nocodb columns get <columnId>
nocodb columns create <tableId> --data '{"title":"Status","column_name":"Status","uidt":"SingleSelect","colOptions":{"options":[{"title":"Open"},{"title":"Done"}]}}'
nocodb columns update <columnId> --data '{"title":"State"}'
nocodb columns delete <columnId>
```

## Schema Introspection

Discover table structures including columns, primary keys, display values, and relations:

```sh
nocodb schema introspect <tableId>
nocodb schema introspect <tableId> --pretty
nocodb schema introspect <tableId> --format table
```

The output includes:
- Table `id`, `title`, `table_name`
- `primaryKey` and `displayValue` column names
- Full column list with `id`, `title`, `column_name`, `uidt`, `primaryKey`, `required`, `unique`
- `relation` object on link columns (`type` and `targetTableId`)

## Settings

Timeout and retry behavior can be configured via `~/.nocodb-cli/settings.json`. Override the directory with `NOCODB_SETTINGS_DIR` env var.

```sh
nocodb settings show           # print current effective settings
nocodb settings path           # print the settings file path
nocodb settings set timeoutMs 5000
nocodb settings set retryCount 5
nocodb settings set retryDelay 500
nocodb settings set retryStatusCodes '[429,500,502,503]'
nocodb settings reset          # restore defaults
```

Default values:

| Key | Default | Description |
|-----|---------|-------------|
| `timeoutMs` | `30000` | Request timeout in milliseconds |
| `retryCount` | `3` | Number of retries (0 to disable) |
| `retryDelay` | `300` | Delay between retries in milliseconds |
| `retryStatusCodes` | `[408,409,425,429,500,502,503,504]` | HTTP status codes that trigger a retry |

CLI flags `--timeout <ms>` and `--retries <count>` override settings for a single invocation:

```sh
nocodb --timeout 5000 bases list
nocodb --retries 0 bases list     # disable retries for this call
```

Use `--verbose` on any command to see request timing and retry information:

```sh
nocodb --verbose rows list <tableId>
```

## Output formats

All commands support `--pretty` for indented JSON and `--format <type>` for alternative output:

```sh
nocodb bases list --pretty              # indented JSON
nocodb bases list --format csv          # CSV output
nocodb bases list --format table        # ASCII table
nocodb rows list <tableId> --format table
```

## Links

Manage linked records between tables:

```sh
nocodb links list <tableId> <linkFieldId> <recordId>
nocodb links create <tableId> <linkFieldId> <recordId> --data '[{"Id":100},{"Id":200}]'
nocodb links delete <tableId> <linkFieldId> <recordId> --data '[{"Id":100}]'
```

## Storage

```sh
nocodb storage upload ./photo.png
nocodb storage upload ./doc.pdf --pretty
```

## Raw requests

Use this to call any endpoint directly.

```sh
nocodb request GET /api/v2/meta/bases --pretty
```

## Swagger discovery (base-scoped)

```sh
nocodb meta swagger <baseId> --pretty
nocodb meta swagger <baseId> --out ./swagger.json
nocodb meta endpoints <baseId>
nocodb meta endpoints <baseId> --tag Tables
nocodb meta cache clear <baseId>
nocodb meta cache clear --all
```

## Dynamic API commands

```sh
nocodb meta endpoints <baseId> --pretty
nocodb --base <baseId> api <tag> <operation> --pretty
nocodb --base <baseId> api <tag> <operation> --data '{"key":"value"}'
```

## Rows (CRUD + upsert helpers)

```sh
nocodb rows list <tableId>
nocodb rows list <tableId> --all              # auto-paginate to fetch every row
nocodb rows list <tableId> --all -q where='(Status,eq,Active)'
nocodb rows read <tableId> <recordId>
nocodb rows create <tableId> --data '{"Title":"Example"}'
nocodb rows update <tableId> --data '{"Id":1,"Title":"Updated"}'
nocodb rows delete <tableId> --data '{"Id":1}'
nocodb rows upsert <tableId> --match Email=alice@example.com --data '{"Email":"alice@example.com","Title":"Alice"}'
nocodb rows upsert <tableId> --match Email=alice@example.com --data '{"Title":"Alice"}' --update-only
nocodb rows upsert <tableId> --match Email=alice@example.com --data '{"Email":"alice@example.com","Title":"Alice"}' --create-only
nocodb rows bulk-create <tableId> --data '[{"Title":"A"},{"Title":"B"}]'
nocodb rows bulk-update <tableId> --data '[{"Id":1,"Title":"A1"},{"Id":2,"Title":"B1"}]'
nocodb rows bulk-upsert <tableId> --match Email --data '[{"Email":"alice@example.com","Title":"Alice"},{"Email":"bob@example.com","Title":"Bob"}]'
nocodb rows bulk-delete <tableId> --data '[{"Id":1},{"Id":2}]'
```

## Data Import / Export

Export all rows from a table to a file or stdout:

```sh
nocodb data export <tableId>                          # JSON to stdout
nocodb data export <tableId> --format csv             # CSV to stdout
nocodb data export <tableId> --out ./rows.json        # JSON file
nocodb data export <tableId> --out ./rows.csv         # CSV file (inferred from extension)
nocodb data export <tableId> -q where='(Status,eq,Active)'  # with filters
```

Import rows from a CSV or JSON file into a table (requires `--base` for schema validation):

```sh
nocodb --base <baseId> data import <tableId> ./rows.json              # JSON array
nocodb --base <baseId> data import <tableId> ./rows.csv               # CSV (inferred from extension)
nocodb --base <baseId> data import <tableId> ./rows.csv --format csv  # explicit format
```

Upsert mode — match on a field to update existing rows and create new ones:

```sh
nocodb --base <baseId> data import <tableId> ./rows.csv --match Email
nocodb --base <baseId> data import <tableId> ./rows.json --match Email --create-only
nocodb --base <baseId> data import <tableId> ./rows.json --match Email --update-only
```

Export auto-paginates (fetches all rows). Import validates rows against the table's swagger schema and batches in groups of 1000.

## E2E test script

Run a repeatable end-to-end flow that creates tables, exercises CRUD, refreshes swagger, and attempts link tests.

```sh
set NOCO_BASE_URL=https://noco.stagware.org
set NOCO_BASE_ID=<baseId>
set NOCO_TOKEN=<token>
node scripts/e2e-cli.mjs
```

PowerShell:

```sh
$env:NOCO_BASE_URL="https://noco.stagware.org"
$env:NOCO_BASE_ID="<baseId>"
$env:NOCO_TOKEN="<token>"
node scripts/e2e-cli.mjs
```

Set `NOCO_KEEP=1` to keep the generated tables instead of deleting them.
You can also run `npm run e2e` from the repo root.

The script attempts:
- Table creation with broad column type coverage (falls back if unsupported types are rejected)
- CRUD on multiple tables
- Link/lookup/rollup/formula column creation (best-effort, logs if unsupported)
- Attachment upload and row update
- Writes a JSON summary report to `scripts/e2e-report.json`

## Error messages

The CLI provides contextual error messages for HTTP failures. When the NocoDB server returns an error, you'll see the status code and any response body the server sent back:

```
HTTP 401 — Unauthorized
```

```
HTTP 400 — Bad Request
{
  "msg": "Field 'Title' is required"
}
```

Non-HTTP errors (invalid JSON input, missing config, validation failures) are printed as-is.

## Notes

- The SDK is in `packages/sdk` and the CLI is in `packages/cli`.
- The SDK uses fully typed generics (e.g., `Promise<ListResponse<Base>>`) for all metadata operations.
- Meta swagger is cached under your CLI config directory for faster reuse.
- Use `nocodb config set baseId <id>` to avoid repeating `--base` for dynamic commands.
- If an endpoint differs in your NocoDB deployment, use `nocodb request` or `nocodb meta endpoints`.
