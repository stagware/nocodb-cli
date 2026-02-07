# Design Document: CLI Refactoring Improvements

## Overview

This design addresses technical debt in the nocodb-cli TypeScript project by improving type safety, configuration management, error handling, test coverage, code organization, dependency injection, and documentation. The refactoring maintains backward compatibility while establishing patterns that improve maintainability and developer experience.

### Goals

- Add comprehensive TypeScript types for all NocoDB API entities
- Consolidate three overlapping configuration systems into one unified approach
- Implement structured error handling with custom error classes
- Achieve 80%+ test coverage with proper mocking
- Refactor large command files into focused service modules
- Implement dependency injection container to reduce coupling
- Add JSDoc documentation for all public APIs

### Non-Goals

- Changing CLI command names or argument formats (backward compatibility required)
- Rewriting the HTTP client (ofetch works well)
- Adding new features beyond the refactoring scope
- Changing the monorepo structure or build system

## Architecture

### High-Level Structure

The refactored architecture separates concerns into clear layers:

```
┌─────────────────────────────────────────┐
│         CLI Commands Layer              │
│  (Argument parsing, output formatting)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Service Layer                   │
│  (Business logic, orchestration)        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         SDK Layer                       │
│  (HTTP client, API methods, types)      │
└─────────────────────────────────────────┘
```

### Package Organization

**SDK Package (`@nocodb/sdk`):**
- `src/types/` - Type definitions for all API entities
- `src/client.ts` - NocoClient HTTP client
- `src/errors.ts` - Custom error classes
- `src/api/meta.ts` - MetaApi with typed methods
- `src/api/data.ts` - DataApi with typed methods
- `src/index.ts` - Public exports

**CLI Package (`@nocodb/cli`):**
- `src/services/` - Business logic services
- `src/config/` - Unified configuration management
- `src/commands/` - Command handlers (thin layer)
- `src/utils/` - Utility functions (formatting, parsing, validation)
- `src/container.ts` - Dependency injection container
- `src/index.ts` - CLI entry point


## Components and Interfaces

### SDK Type System

**Core Entity Types:**

```typescript
// packages/sdk/src/types/entities.ts

export interface Base {
  id: string;
  title: string;
  type?: string;
  is_meta?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Table {
  id: string;
  base_id: string;
  title: string;
  table_name: string;
  type?: string;
  enabled?: boolean;
  order?: number;
  columns?: Column[];
  created_at?: string;
  updated_at?: string;
}

export interface View {
  id: string;
  title: string;
  type: ViewType;
  fk_model_id: string;
  show?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export type ViewType = 'grid' | 'form' | 'gallery' | 'kanban' | 'calendar';

export interface Column {
  id: string;
  title: string;
  column_name: string;
  uidt: ColumnType;
  dt?: string;
  pk?: boolean;
  pv?: boolean;
  rqd?: boolean;
  system?: boolean;
  fk_model_id: string;
  created_at?: string;
  updated_at?: string;
}

export type ColumnType = 
  | 'SingleLineText' | 'LongText' | 'Number' | 'Decimal'
  | 'Currency' | 'Percent' | 'Duration' | 'Rating'
  | 'Date' | 'DateTime' | 'Time' | 'Year'
  | 'Checkbox' | 'SingleSelect' | 'MultiSelect'
  | 'Email' | 'URL' | 'PhoneNumber'
  | 'LinkToAnotherRecord' | 'Lookup' | 'Rollup' | 'Formula'
  | 'Attachment' | 'Barcode' | 'QrCode' | 'JSON';

export interface Filter {
  id: string;
  fk_view_id: string;
  fk_column_id?: string;
  logical_op?: 'and' | 'or';
  comparison_op?: ComparisonOperator;
  value?: string | number | boolean | null;
  fk_parent_id?: string;
  is_group?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ComparisonOperator =
  | 'eq' | 'neq' | 'like' | 'nlike' | 'empty' | 'notempty'
  | 'null' | 'notnull' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'allof' | 'anyof' | 'nallof' | 'nanyof';

export interface Sort {
  id: string;
  fk_view_id: string;
  fk_column_id: string;
  direction: 'asc' | 'desc';
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Row {
  Id?: string | number;
  [key: string]: unknown;
}
```

**Response Types:**

```typescript
// packages/sdk/src/types/responses.ts

export interface ListResponse<T> {
  list: T[];
  pageInfo: PageInfo;
}

export interface PageInfo {
  totalRows?: number;
  page?: number;
  pageSize?: number;
  isFirstPage?: boolean;
  isLastPage?: boolean;
}

export interface BulkCreateResponse {
  created: number;
  data?: Row[];
}

export interface BulkUpdateResponse {
  updated: number;
  data?: Row[];
}

export interface BulkDeleteResponse {
  deleted: number;
}

export interface ErrorResponse {
  msg?: string;
  message?: string;
  error?: string;
}
```

### SDK Error System

```typescript
// packages/sdk/src/errors.ts

export class NocoDBError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'NocoDBError';
  }
}

export class NetworkError extends NocoDBError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.cause = cause;
  }
}

export class AuthenticationError extends NocoDBError {
  constructor(message: string, statusCode: number, data?: unknown) {
    super(message, 'AUTH_ERROR', statusCode, data);
  }
}

export class ValidationError extends NocoDBError {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends NocoDBError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends NocoDBError {
  constructor(message: string, data?: unknown) {
    super(message, 'CONFLICT', 409, data);
  }
}
```

### SDK Typed API Methods

```typescript
// packages/sdk/src/api/meta.ts

export class MetaApi {
  constructor(private client: NocoClient) {}

  async listBases(): Promise<ListResponse<Base>> {
    return this.client.request<ListResponse<Base>>('GET', '/api/v2/meta/bases');
  }

  async createBase(data: Partial<Base>): Promise<Base> {
    return this.client.request<Base>('POST', '/api/v2/meta/bases', { body: data });
  }

  async getBase(baseId: string): Promise<Base> {
    return this.client.request<Base>('GET', `/api/v2/meta/bases/${baseId}`);
  }

  async updateBase(baseId: string, data: Partial<Base>): Promise<Base> {
    return this.client.request<Base>('PATCH', `/api/v2/meta/bases/${baseId}`, { body: data });
  }

  async deleteBase(baseId: string): Promise<void> {
    await this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}`);
  }

  // Similar typed methods for tables, views, columns, filters, sorts...
}
```


### Unified Configuration System

```typescript
// packages/cli/src/config/types.ts

export interface WorkspaceConfig {
  baseUrl: string;
  headers: Record<string, string>;
  baseId?: string;
  aliases: Record<string, string>;
}

export interface GlobalSettings {
  timeoutMs: number;
  retryCount: number;
  retryDelay: number;
  retryStatusCodes: number[];
}

export interface UnifiedConfig {
  version: 2;
  activeWorkspace?: string;
  workspaces: Record<string, WorkspaceConfig>;
  settings: GlobalSettings;
}

// packages/cli/src/config/manager.ts

export class ConfigManager {
  private config: UnifiedConfig;
  private configPath: string;

  constructor(configDir?: string) {
    this.configPath = this.resolveConfigPath(configDir);
    this.config = this.loadOrMigrate();
  }

  private loadOrMigrate(): UnifiedConfig {
    // Try loading v2 config
    const v2Path = path.join(this.configDir, 'config.v2.json');
    if (fs.existsSync(v2Path)) {
      return JSON.parse(fs.readFileSync(v2Path, 'utf8'));
    }

    // Migrate from legacy config files
    return this.migrateFromLegacy();
  }

  private migrateFromLegacy(): UnifiedConfig {
    const legacyConfig = this.loadLegacyConfig();
    const legacySettings = this.loadLegacySettings();
    const legacyAliases = this.loadLegacyAliases();

    const unified: UnifiedConfig = {
      version: 2,
      workspaces: legacyAliases,
      settings: legacySettings,
    };

    // Migrate legacy global config to default workspace if present
    if (legacyConfig.baseUrl) {
      unified.workspaces['default'] = {
        baseUrl: legacyConfig.baseUrl,
        headers: legacyConfig.headers || {},
        baseId: legacyConfig.baseId,
        aliases: {},
      };
      unified.activeWorkspace = 'default';
    }

    this.save(unified);
    return unified;
  }

  getActiveWorkspace(): WorkspaceConfig | undefined {
    if (!this.config.activeWorkspace) return undefined;
    return this.config.workspaces[this.config.activeWorkspace];
  }

  setActiveWorkspace(name: string): void {
    if (!this.config.workspaces[name]) {
      throw new ValidationError(`Workspace '${name}' does not exist`);
    }
    this.config.activeWorkspace = name;
    this.save();
  }

  addWorkspace(name: string, config: WorkspaceConfig): void {
    this.config.workspaces[name] = config;
    this.save();
  }

  resolveAlias(input: string): { id: string; workspace?: WorkspaceConfig } {
    // Check for explicit namespace (workspace.alias)
    const dotIndex = input.indexOf('.');
    if (dotIndex !== -1) {
      const wsName = input.slice(0, dotIndex);
      const alias = input.slice(dotIndex + 1);
      const ws = this.config.workspaces[wsName];
      if (ws?.aliases[alias]) {
        return { id: ws.aliases[alias], workspace: ws };
      }
    }

    // Check current workspace
    const activeWs = this.getActiveWorkspace();
    if (activeWs?.aliases[input]) {
      return { id: activeWs.aliases[input], workspace: activeWs };
    }

    // Check for workspace-level alias (workspace name -> baseId)
    const ws = this.config.workspaces[input];
    if (ws?.baseId) {
      return { id: ws.baseId, workspace: ws };
    }

    return { id: input };
  }

  getEffectiveConfig(cliFlags: Partial<GlobalSettings>): {
    workspace?: WorkspaceConfig;
    settings: GlobalSettings;
  } {
    // Precedence: CLI flags > workspace config > global settings > defaults
    const workspace = this.getActiveWorkspace();
    const settings = {
      ...DEFAULT_SETTINGS,
      ...this.config.settings,
      ...cliFlags,
    };
    return { workspace, settings };
  }

  private save(config = this.config): void {
    const v2Path = path.join(this.configDir, 'config.v2.json');
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(v2Path, JSON.stringify(config, null, 2), 'utf8');
  }
}
```

### Service Layer

```typescript
// packages/cli/src/services/row-service.ts

export class RowService {
  constructor(
    private client: NocoClient,
    private swaggerService: SwaggerService
  ) {}

  async list(tableId: string, query?: Record<string, string>): Promise<ListResponse<Row>> {
    return this.client.request<ListResponse<Row>>(
      'GET',
      `/api/v2/tables/${tableId}/records`,
      { query }
    );
  }

  async create(tableId: string, data: Row, baseId: string): Promise<Row> {
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, 'post', `/api/v2/tables/${tableId}/records`);
    if (op) validateRequestBody(op, swagger, data);

    return this.client.request<Row>(
      'POST',
      `/api/v2/tables/${tableId}/records`,
      { body: data }
    );
  }

  async bulkCreate(tableId: string, rows: Row[], baseId: string): Promise<BulkCreateResponse> {
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, 'post', `/api/v2/tables/${tableId}/records`);
    if (op) validateRequestBody(op, swagger, rows);

    return this.client.request<BulkCreateResponse>(
      'POST',
      `/api/v2/tables/${tableId}/records`,
      { body: rows }
    );
  }

  async upsert(
    tableId: string,
    data: Row,
    matchField: string,
    matchValue: string,
    baseId: string,
    options: { createOnly?: boolean; updateOnly?: boolean } = {}
  ): Promise<Row> {
    // Business logic for upsert operation
    const existing = await this.findByField(tableId, matchField, matchValue);

    if (existing.length > 1) {
      throw new ValidationError(
        `Multiple rows matched '${matchField}=${matchValue}'. Upsert requires unique match.`
      );
    }

    if (existing.length === 0) {
      if (options.updateOnly) {
        throw new NotFoundError('Row', `${matchField}=${matchValue}`);
      }
      return this.create(tableId, data, baseId);
    }

    if (options.createOnly) {
      throw new ConflictError(`Row already exists: ${matchField}=${matchValue}`);
    }

    const recordId = existing[0].Id!;
    return this.update(tableId, { ...data, Id: recordId }, baseId);
  }

  private async findByField(
    tableId: string,
    field: string,
    value: string
  ): Promise<Row[]> {
    const result = await this.list(tableId);
    return result.list.filter(row => String(row[field]) === value);
  }

  // Additional methods: update, delete, bulkUpdate, bulkDelete, bulkUpsert...
}
```


### Dependency Injection Container

```typescript
// packages/cli/src/container.ts

export interface Container {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
}

export class ServiceContainer implements Container {
  private services = new Map<string, unknown>();

  get<T>(key: string): T {
    if (!this.services.has(key)) {
      throw new Error(`Service '${key}' not registered in container`);
    }
    return this.services.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    this.services.set(key, value);
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  clear(): void {
    this.services.clear();
  }
}

// Container initialization
export function createContainer(configManager: ConfigManager): Container {
  const container = new ServiceContainer();

  // Register configuration
  container.set('configManager', configManager);

  // Register factory for NocoClient (created per-request with workspace context)
  container.set('createClient', (workspace?: WorkspaceConfig, settings?: GlobalSettings) => {
    const baseUrl = workspace?.baseUrl || configManager.getActiveWorkspace()?.baseUrl;
    if (!baseUrl) {
      throw new ValidationError('Base URL not configured');
    }

    const headers = workspace?.headers || configManager.getActiveWorkspace()?.headers || {};
    const effectiveSettings = settings || configManager.getEffectiveConfig({}).settings;

    return new NocoClient({
      baseUrl,
      headers,
      timeoutMs: effectiveSettings.timeoutMs,
      retry: {
        retry: effectiveSettings.retryCount === 0 ? false : effectiveSettings.retryCount,
        retryDelay: effectiveSettings.retryDelay,
        retryStatusCodes: effectiveSettings.retryStatusCodes,
      },
    });
  });

  // Register services
  container.set('swaggerService', new SwaggerService(
    container.get('createClient'),
    configManager
  ));

  container.set('rowService', (client: NocoClient) => 
    new RowService(client, container.get('swaggerService'))
  );

  container.set('metaService', (client: NocoClient) =>
    new MetaService(client)
  );

  return container;
}

// Usage in command handlers
function registerRowCommands(program: Command, container: Container) {
  const rowsCmd = program.command('rows');

  rowsCmd
    .command('list')
    .argument('tableId', 'Table id')
    .action(async (tableId: string, options: any) => {
      try {
        const configManager = container.get<ConfigManager>('configManager');
        const { workspace, settings } = configManager.getEffectiveConfig(options);
        const createClient = container.get<Function>('createClient');
        const client = createClient(workspace, settings);
        const rowService = container.get<Function>('rowService')(client);

        const resolvedTableId = configManager.resolveAlias(tableId).id;
        const result = await rowService.list(resolvedTableId, options.query);
        
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    });
}
```

### Utility Modules

```typescript
// packages/cli/src/utils/formatting.ts

export function formatJson(data: unknown, pretty: boolean): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

export function formatCsv(data: unknown): string {
  const rows = unwrapData(data);
  if (rows.length === 0) return '';
  
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const lines: string[] = [keys.map(escapeCsvField).join(',')];
  
  for (const row of rows) {
    lines.push(keys.map(k => escapeCsvField(row[k])).join(','));
  }
  
  return lines.join('\n');
}

export function formatTable(data: unknown): string {
  // Table formatting logic...
}

// packages/cli/src/utils/parsing.ts

export function parseJsonInput(data?: string, dataFile?: string): unknown {
  if (dataFile) {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  }
  if (data) {
    return JSON.parse(data);
  }
  throw new ValidationError('Provide --data or --data-file');
}

export function parseKeyValue(input: string): [string, string] {
  const idx = input.indexOf('=');
  if (idx === -1) {
    throw new ValidationError(`Invalid format '${input}'. Use 'key=value'.`);
  }
  const key = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!key || !value) {
    throw new ValidationError(`Invalid format '${input}'. Use 'key=value'.`);
  }
  return [key, value];
}

// packages/cli/src/utils/swagger.ts

export function findOperation(
  doc: SwaggerDoc,
  method: string,
  path: string
): Operation | undefined {
  const pathItem = doc.paths?.[path];
  if (!pathItem) return undefined;
  
  const op = pathItem[method.toLowerCase()];
  if (!op) return undefined;
  
  return { method: method.toLowerCase(), path, ...op };
}

export function validateRequestBody(
  op: Operation,
  doc: SwaggerDoc,
  body: unknown
): void {
  const { schema, required } = getBodySchema(op);
  
  if (!schema) return;
  if (required && body === undefined) {
    throw new ValidationError('Request body is required');
  }
  if (body === undefined) return;

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile({
    ...schema,
    definitions: doc.definitions,
    components: doc.components,
  });

  if (!validate(body)) {
    const errors = validate.errors
      ?.map(err => `${err.instancePath || '/'} ${err.message}`)
      .join('; ');
    throw new ValidationError(`Schema validation failed: ${errors}`);
  }
}
```


## Data Models

### Type Hierarchy

```
NocoDBError (base)
├── NetworkError (connection failures)
├── AuthenticationError (401, 403)
├── ValidationError (400, schema validation)
├── NotFoundError (404)
└── ConflictError (409)
```

### Configuration Data Flow

```
CLI Flags (highest precedence)
    ↓
Workspace Config (per-workspace settings)
    ↓
Global Settings (shared across workspaces)
    ↓
Default Values (lowest precedence)
```

### Entity Relationships

```
Base (1) ──→ (N) Table
Table (1) ──→ (N) View
Table (1) ──→ (N) Column
View (1) ──→ (N) Filter
View (1) ──→ (N) Sort
Table (1) ──→ (N) Row
```

### Migration Strategy

The configuration migration follows this process:

1. Check for `config.json` (new format)
2. If not found, look for legacy files:
   - `config.json` (Conf-based legacy config)
   - `settings.json` (timeout/retry settings)
   - `config.v2.json` from aliases.ts (workspace configs)
3. Merge legacy configs into unified format
4. Write `config.json`
5. Keep legacy files for rollback (don't delete)


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. During reflection, I consolidated related properties to avoid redundancy:

- Configuration precedence (2.5) is the core property; workspace isolation (2.3) and global settings (2.4) are subsumed by it
- Error formatting properties (3.4, 3.5) can be combined into one comprehensive property
- Bulk operation error reporting (9.2, 9.3) can be combined into one property
- Backward compatibility properties (8.1, 8.2, 8.4, 8.5) cover different aspects and should remain separate

### Configuration Management Properties

**Property 1: Configuration persistence round-trip**

*For any* valid configuration value (workspace config, global setting, or alias), setting it and then reading it back should return the same value.

**Validates: Requirements 2.2**

**Property 2: Configuration precedence order**

*For any* configuration key that can be set at multiple levels (CLI flag, workspace config, global config, default), the effective value should always follow the precedence order: CLI flags > workspace config > global config > defaults.

**Validates: Requirements 2.5**

**Property 3: Legacy configuration migration**

*For any* valid legacy configuration file (config.json, settings.json, or old aliases format), migrating it to the unified format should preserve all configuration values and make them accessible through the new API.

**Validates: Requirements 2.6**

**Property 4: Configuration validation**

*For any* invalid configuration value (negative timeout, invalid URL format, malformed JSON), the configuration manager should reject it with a clear ValidationError describing the problem.

**Validates: Requirements 2.9**

### Error Handling Properties

**Property 5: HTTP error mapping**

*For any* HTTP error response (4xx or 5xx status code), the SDK should throw the appropriate typed error (AuthenticationError for 401/403, NotFoundError for 404, ConflictError for 409, ValidationError for 400) with status code, message, and response data populated.

**Validates: Requirements 3.2**

**Property 6: Error formatting consistency**

*For any* error type (NetworkError, AuthenticationError, ValidationError, NotFoundError, ConflictError), the CLI should format it for terminal output with error type, message, and relevant context (status code, field errors) in a consistent structure.

**Validates: Requirements 3.4, 3.5**

**Property 7: Error code presence**

*For any* NocoDBError thrown by the SDK, it should include a non-empty error code field for programmatic error handling.

**Validates: Requirements 3.9**

**Property 8: Bulk operation error reporting**

*For any* bulk operation that encounters partial failures, the result should include separate success and failure counts, plus details about which specific items failed and why.

**Validates: Requirements 3.8, 9.2, 9.3**

### Backward Compatibility Properties

**Property 9: Command compatibility**

*For any* existing CLI command from the pre-refactoring version, executing it with the same arguments should produce equivalent output (same data, possibly different formatting) in the refactored version.

**Validates: Requirements 8.1**

**Property 10: Configuration file compatibility**

*For any* legacy configuration file format (config.json, settings.json), the refactored CLI should be able to read and use the configuration values correctly.

**Validates: Requirements 8.2**

**Property 11: Environment variable compatibility**

*For any* existing environment variable (NOCO_QUIET, NOCODB_SETTINGS_DIR, NOCO_CONFIG_DIR), setting it should affect CLI behavior in the same way as the pre-refactoring version.

**Validates: Requirements 8.4**

**Property 12: Output format compatibility**

*For any* output format flag (--format json, --format csv, --format table), the output structure should match the pre-refactoring version's format.

**Validates: Requirements 8.5**

### Resilience Properties

**Property 13: Bulk operation continuation**

*For any* bulk operation with a mix of valid and invalid items, when --continue-on-error is enabled (default), all valid items should be processed successfully regardless of invalid item failures.

**Validates: Requirements 9.1**

**Property 14: Retry behavior**

*For any* network request that fails with a retryable status code (408, 429, 500, 502, 503, 504), the SDK should retry the request up to the configured retry count before throwing an error.

**Validates: Requirements 9.6**

### Performance Properties

**Property 15: Batch size configuration**

*For any* bulk operation with a --batch-size flag, the operation should process items in batches of the specified size (verifiable through request patterns or memory usage).

**Validates: Requirements 10.2**

**Property 16: Swagger caching**

*For any* base ID, after the first swagger fetch, subsequent operations on that base should use the cached swagger document without making additional fetch requests (unless --no-cache is specified).

**Validates: Requirements 10.5**

