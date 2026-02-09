# @stagware/nocodb-sdk

TypeScript SDK for the NocoDB v2 API — typed clients for metadata, data, and admin operations.

## Install

```sh
npm install @stagware/nocodb-sdk
```

## Quick Start

```typescript
import { NocoClient, MetaApi } from '@stagware/nocodb-sdk';

const client = new NocoClient({
  baseUrl: 'https://app.nocodb.com',
  headers: { 'xc-token': 'your-api-token' },
});

const meta = new MetaApi(client);

// List all bases
const bases = await meta.listBases();
console.log(bases.list);

// Create a table
const table = await meta.createTable('base_id', {
  title: 'Users',
  table_name: 'users',
});

// CRUD on records
const rows = await client.request('GET', '/api/v2/tables/tbl_id/records');
```

## Features

- **50+ typed API methods** — bases, tables, views, columns, filters, sorts, hooks, sources, tokens, users, comments, shared views/base, visibility rules, duplicates, app info, cloud workspaces
- **Auto-pagination** — `fetchAllPages()` fetches all pages of any paginated endpoint
- **Typed errors** — `AuthenticationError`, `NotFoundError`, `ValidationError`, `ConflictError`, `NetworkError`
- **Retry & timeout** — configurable via `RetryOptions` and `timeoutMs`
- **Tree-shakeable** — ESM-only, all types exported

## API Classes

### `NocoClient`

Low-level HTTP client with error mapping, retry, and timeout.

```typescript
const client = new NocoClient({
  baseUrl: 'https://app.nocodb.com',
  headers: { 'xc-token': 'token' },
  timeoutMs: 30000,
  retry: { retry: 3, retryDelay: 1000, retryStatusCodes: [429, 500, 502, 503] },
});

const result = await client.request<MyType>('GET', '/api/v2/meta/bases');
const allRows = await client.fetchAllPages<Row>('GET', '/api/v2/tables/tbl_id/records');
```

### `MetaApi`

Typed methods for all metadata CRUD operations.

```typescript
const meta = new MetaApi(client);

await meta.listBases();
await meta.createTable(baseId, { title: 'Tasks' });
await meta.listViews(tableId);
await meta.createViewFilter(viewId, { fk_column_id: 'col_id', comparison_op: 'eq', value: 'active' });
```

### `DataApi`

Record and link operations.

```typescript
const data = new DataApi(client);

await data.listLinks(tableId, linkFieldId, recordId);
await data.linkRecords(tableId, linkFieldId, recordId, [{ Id: 100 }]);
```

## Types

All entity types are exported: `Base`, `Table`, `View`, `Column`, `Filter`, `Sort`, `Row`, `Hook`, `ApiToken`, `BaseUser`, `Comment`, `SharedView`, `SharedBase`, `ViewColumn`, `FormView`, `GalleryView`, `KanbanView`, `GridView`, `AppInfo`, `VisibilityRule`, `DuplicateOptions`, `NcWorkspace`, `NcWorkspaceUser`.

Response types: `ListResponse<T>`, `PageInfo`, `BulkCreateResponse`, `BulkUpdateResponse`, `BulkDeleteResponse`, `ErrorResponse`.

## License

MIT
