import fs from "node:fs";
import path from "node:path";
import { ofetch, FetchError } from "ofetch";

// Import types for internal use
import type {
  Base,
  Table,
  View,
  Column,
  Filter,
  Sort,
  Row,
} from "./types/entities.js";

import type {
  ListResponse,
  ErrorResponse,
} from "./types/responses.js";

// Import error classes for internal use
import {
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "./errors.js";

// Export entity types
export type {
  Base,
  Table,
  View,
  ViewType,
  Column,
  ColumnType,
  Filter,
  ComparisonOperator,
  Sort,
  Row,
} from "./types/entities.js";

// Export response types
export type {
  ListResponse,
  PageInfo,
  BulkCreateResponse,
  BulkUpdateResponse,
  BulkDeleteResponse,
  BulkOperationError,
  BulkCreateResponseWithErrors,
  BulkUpdateResponseWithErrors,
  BulkDeleteResponseWithErrors,
  ErrorResponse,
} from "./types/responses.js";

// Export error classes
export {
  NocoDBError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "./errors.js";

/**
 * Map of HTTP header names to values.
 */
export type HeadersMap = Record<string, string>;

/**
 * Configuration options for request retry behavior.
 */
export interface RetryOptions {
  /** Number of retry attempts, or false to disable retries */
  retry?: number | false;
  /** Delay in milliseconds between retry attempts */
  retryDelay?: number;
  /** HTTP status codes that should trigger a retry */
  retryStatusCodes?: number[];
}

/**
 * Options for individual HTTP requests.
 */
export interface RequestOptions {
  /** Additional headers to include in the request */
  headers?: HeadersMap;
  /** Query parameters to append to the URL */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Request body (will be JSON-serialized) */
  body?: unknown;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Retry configuration for this request */
  retry?: RetryOptions;
}

/**
 * Configuration options for creating a NocoClient instance.
 */
export interface ClientOptions {
  /** Base URL of the NocoDB instance (e.g., 'https://app.nocodb.com') */
  baseUrl: string;
  /** Default headers to include in all requests (e.g., authentication token) */
  headers?: HeadersMap;
  /** Default timeout in milliseconds for all requests */
  timeoutMs?: number;
  /** Default retry configuration for all requests */
  retry?: RetryOptions;
}

/**
 * HTTP client for making requests to NocoDB APIs.
 * 
 * Provides low-level HTTP request functionality with automatic error mapping,
 * retry logic, and timeout handling. Most users should use MetaApi or DataApi
 * instead of calling this directly.
 * 
 * @example
 * ```typescript
 * const client = new NocoClient({
 *   baseUrl: 'https://app.nocodb.com',
 *   headers: { 'xc-token': 'your-api-token' },
 *   timeoutMs: 30000,
 *   retry: {
 *     retry: 3,
 *     retryDelay: 1000,
 *     retryStatusCodes: [408, 429, 500, 502, 503, 504]
 *   }
 * });
 * ```
 */
export class NocoClient {
  private baseUrl: string;
  private headers: HeadersMap;
  private timeoutMs?: number;
  private retryOptions?: RetryOptions;

  /**
   * Creates a new NocoClient instance.
   * 
   * @param options - Client configuration options
   */
  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.headers = { ...(options.headers ?? {}) };
    this.timeoutMs = options.timeoutMs;
    this.retryOptions = options.retry;
  }

  /**
   * Sets a default header that will be included in all requests.
   * 
   * @param name - Header name
   * @param value - Header value
   * 
   * @example
   * ```typescript
   * client.setHeader('xc-token', 'new-api-token');
   * ```
   */
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Removes a default header.
   * 
   * @param name - Header name to remove
   * 
   * @example
   * ```typescript
   * client.removeHeader('xc-token');
   * ```
   */
  removeHeader(name: string): void {
    delete this.headers[name];
  }

  /**
   * Makes an HTTP request to the NocoDB API.
   * 
   * Automatically handles error mapping, retry logic, and timeout handling.
   * Throws typed errors (AuthenticationError, NotFoundError, etc.) based on
   * HTTP status codes.
   * 
   * @template T - Expected response type
   * @param method - HTTP method (GET, POST, PATCH, DELETE, etc.)
   * @param path - API endpoint path (e.g., '/api/v2/meta/bases')
   * @param options - Request options (headers, query params, body, etc.)
   * @returns Promise resolving to the typed response
   * @throws {AuthenticationError} When authentication fails (401, 403)
   * @throws {NotFoundError} When resource is not found (404)
   * @throws {ConflictError} When a conflict occurs (409)
   * @throws {ValidationError} When request validation fails (400)
   * @throws {NetworkError} For network-level errors or other HTTP errors
   * 
   * @example
   * ```typescript
   * const bases = await client.request<ListResponse<Base>>(
   *   'GET',
   *   '/api/v2/meta/bases'
   * );
   * 
   * const newBase = await client.request<Base>(
   *   'POST',
   *   '/api/v2/meta/bases',
   *   { body: { title: 'My Base' } }
   * );
   * ```
   */
  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const urlPath = path.startsWith("/") ? path : `/${path}`;
    const headers = { ...this.headers, ...(options.headers ?? {}) };
    const retry = options.retry ?? this.retryOptions;
    const isVerbose = process.argv.includes('--verbose');

    let attemptCount = 0;
    const startTime = Date.now();

    try {
      const result = await ofetch<T>(urlPath, {
        baseURL: this.baseUrl,
        method,
        headers,
        query: options.query,
        body: options.body as unknown as Record<string, unknown> | BodyInit | null | undefined,
        timeout: options.timeoutMs ?? this.timeoutMs,
        retry: retry?.retry,
        retryDelay: retry?.retryDelay,
        retryStatusCodes: retry?.retryStatusCodes,
        onRequest: () => {
          attemptCount++;
          if (isVerbose && attemptCount > 1) {
            console.error(`[Retry] Attempt ${attemptCount} for ${method} ${urlPath}`);
          }
        },
      });

      // Log timing in verbose mode
      if (isVerbose) {
        const duration = Date.now() - startTime;
        console.error(`[Timing] ${method} ${urlPath} completed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      // Log timing for failed requests in verbose mode
      if (isVerbose) {
        const duration = Date.now() - startTime;
        console.error(`[Timing] ${method} ${urlPath} failed after ${duration}ms`);
        
        if (attemptCount > 1) {
          console.error(`[Retry] All ${attemptCount} attempts failed for ${method} ${urlPath}`);
        }
      }

      // Handle FetchError from ofetch
      if (error instanceof FetchError) {
        const statusCode = error.response?.status;
        const responseData = error.data as ErrorResponse | undefined;
        
        // Extract error message from response
        const errorMessage = 
          responseData?.msg || 
          responseData?.message || 
          responseData?.error || 
          error.message || 
          'Request failed';

        // Map status codes to typed errors
        if (statusCode === 401 || statusCode === 403) {
          throw new AuthenticationError(errorMessage, statusCode, responseData);
        }
        
        if (statusCode === 404) {
          throw new NotFoundError('Resource', errorMessage);
        }
        
        if (statusCode === 409) {
          throw new ConflictError(errorMessage, responseData);
        }
        
        if (statusCode === 400) {
          throw new ValidationError(errorMessage);
        }

        // For other HTTP errors, throw NetworkError with status code
        throw new NetworkError(
          `HTTP ${statusCode}: ${errorMessage}`,
          error
        );
      }

      // Handle network-level errors (connection failures, timeouts, etc.)
      if (error instanceof Error) {
        throw new NetworkError(error.message, error);
      }

      // Fallback for unknown error types
      throw new NetworkError('Unknown error occurred', error as Error);
    }
  }
}

/**
 * Reference to a base by ID and optional title.
 * Used for identifying bases in API operations.
 */
export interface BaseRef {
  /** Unique identifier for the base */
  id: string;
  /** Optional display title */
  title?: string;
}

/**
 * Reference to a table by ID and optional title.
 * Used for identifying tables in API operations.
 */
export interface TableRef {
  /** Unique identifier for the table */
  id: string;
  /** Optional display title */
  title?: string;
}

/**
 * Reference to a view by ID and optional title.
 * Used for identifying views in API operations.
 */
export interface ViewRef {
  /** Unique identifier for the view */
  id: string;
  /** Optional display title */
  title?: string;
}

/**
 * Reference to a filter by ID.
 * Used for identifying filters in API operations.
 */
export interface FilterRef {
  /** Unique identifier for the filter */
  id: string;
}

/**
 * Reference to a sort by ID.
 * Used for identifying sorts in API operations.
 */
export interface SortRef {
  /** Unique identifier for the sort */
  id: string;
}

/**
 * Reference to a column by ID.
 * Used for identifying columns in API operations.
 */
export interface ColumnRef {
  /** Unique identifier for the column */
  id: string;
}

/**
 * API methods for metadata operations (bases, tables, views, columns, filters, sorts).
 * 
 * Provides typed methods for all CRUD operations on NocoDB metadata entities.
 * All methods return strongly-typed responses and throw typed errors on failure.
 * 
 * @example
 * ```typescript
 * const client = new NocoClient({ baseUrl: '...', headers: { 'xc-token': '...' } });
 * const metaApi = new MetaApi(client);
 * 
 * // List all bases
 * const bases = await metaApi.listBases();
 * 
 * // Create a new table
 * const table = await metaApi.createTable('base_id', {
 *   title: 'Users',
 *   table_name: 'users'
 * });
 * ```
 */
export class MetaApi {
  /**
   * Creates a new MetaApi instance.
   * 
   * @param client - NocoClient instance for making HTTP requests
   */
  constructor(private client: NocoClient) {}

  /**
   * Lists all bases accessible to the authenticated user.
   * 
   * @returns Promise resolving to paginated list of bases
   * @throws {AuthenticationError} If authentication fails
   * @throws {NetworkError} If the request fails
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listBases();
   * console.log(`Found ${response.pageInfo.totalRows} bases`);
   * ```
   */
  listBases(): Promise<ListResponse<Base>> {
    return this.client.request<ListResponse<Base>>("GET", "/api/v2/meta/bases");
  }

  /**
   * Creates a new base.
   * 
   * @param body - Base properties (title is required)
   * @returns Promise resolving to the created base
   * @throws {ValidationError} If the request data is invalid
   * @throws {AuthenticationError} If authentication fails
   * 
   * @example
   * ```typescript
   * const base = await metaApi.createBase({ title: 'My Project' });
   * console.log(`Created base: ${base.id}`);
   * ```
   */
  createBase(body: Partial<Base>): Promise<Base> {
    return this.client.request<Base>("POST", "/api/v2/meta/bases", { body });
  }

  /**
   * Gets detailed information about a specific base.
   * 
   * @param baseId - ID of the base to retrieve
   * @returns Promise resolving to the base details
   * @throws {NotFoundError} If the base doesn't exist
   * @throws {AuthenticationError} If authentication fails
   * 
   * @example
   * ```typescript
   * const base = await metaApi.getBase('base_abc123');
   * console.log(`Base title: ${base.title}`);
   * ```
   */
  getBase(baseId: string): Promise<Base> {
    return this.client.request<Base>("GET", `/api/v2/meta/bases/${baseId}`);
  }

  /**
   * Gets base information including metadata.
   * 
   * @param baseId - ID of the base
   * @returns Promise resolving to the base info
   * @throws {NotFoundError} If the base doesn't exist
   * 
   * @example
   * ```typescript
   * const info = await metaApi.getBaseInfo('base_abc123');
   * ```
   */
  getBaseInfo(baseId: string): Promise<Base> {
    return this.client.request<Base>("GET", `/api/v2/meta/bases/${baseId}/info`);
  }

  /**
   * Updates a base's properties.
   * 
   * @param baseId - ID of the base to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated base
   * @throws {NotFoundError} If the base doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateBase('base_abc123', { title: 'New Title' });
   * ```
   */
  updateBase(baseId: string, body: Partial<Base>): Promise<Base> {
    return this.client.request<Base>("PATCH", `/api/v2/meta/bases/${baseId}`, { body });
  }

  /**
   * Deletes a base permanently.
   * 
   * @param baseId - ID of the base to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the base doesn't exist
   * @throws {AuthenticationError} If authentication fails
   * 
   * @example
   * ```typescript
   * await metaApi.deleteBase('base_abc123');
   * console.log('Base deleted');
   * ```
   */
  deleteBase(baseId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/bases/${baseId}`);
  }

  /**
   * Lists all tables in a base.
   * 
   * @param baseId - ID of the base
   * @returns Promise resolving to paginated list of tables
   * @throws {NotFoundError} If the base doesn't exist
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listTables('base_abc123');
   * for (const table of response.list) {
   *   console.log(`Table: ${table.title}`);
   * }
   * ```
   */
  listTables(baseId: string): Promise<ListResponse<Table>> {
    return this.client.request<ListResponse<Table>>("GET", `/api/v2/meta/bases/${baseId}/tables`);
  }

  /**
   * Creates a new table in a base.
   * 
   * @param baseId - ID of the base
   * @param body - Table properties (title and table_name are required)
   * @returns Promise resolving to the created table
   * @throws {ValidationError} If the request data is invalid
   * @throws {ConflictError} If a table with the same name already exists
   * 
   * @example
   * ```typescript
   * const table = await metaApi.createTable('base_abc123', {
   *   title: 'Users',
   *   table_name: 'users'
   * });
   * ```
   */
  createTable(baseId: string, body: Partial<Table>): Promise<Table> {
    return this.client.request<Table>("POST", `/api/v2/meta/bases/${baseId}/tables`, { body });
  }

  /**
   * Gets detailed information about a specific table.
   * 
   * @param tableId - ID of the table to retrieve
   * @returns Promise resolving to the table details including columns
   * @throws {NotFoundError} If the table doesn't exist
   * 
   * @example
   * ```typescript
   * const table = await metaApi.getTable('tbl_abc123');
   * console.log(`Table has ${table.columns?.length} columns`);
   * ```
   */
  getTable(tableId: string): Promise<Table> {
    return this.client.request<Table>("GET", `/api/v2/meta/tables/${tableId}`);
  }

  /**
   * Updates a table's properties.
   * 
   * @param tableId - ID of the table to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated table
   * @throws {NotFoundError} If the table doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateTable('tbl_abc123', { title: 'New Title' });
   * ```
   */
  updateTable(tableId: string, body: Partial<Table>): Promise<Table> {
    return this.client.request<Table>("PATCH", `/api/v2/meta/tables/${tableId}`, { body });
  }

  /**
   * Deletes a table permanently.
   * 
   * @param tableId - ID of the table to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the table doesn't exist
   * 
   * @example
   * ```typescript
   * await metaApi.deleteTable('tbl_abc123');
   * ```
   */
  deleteTable(tableId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/tables/${tableId}`);
  }

  /**
   * Lists all views for a table.
   * 
   * @param tableId - ID of the table
   * @returns Promise resolving to paginated list of views
   * @throws {NotFoundError} If the table doesn't exist
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listViews('tbl_abc123');
   * for (const view of response.list) {
   *   console.log(`View: ${view.title} (${view.type})`);
   * }
   * ```
   */
  listViews(tableId: string): Promise<ListResponse<View>> {
    return this.client.request<ListResponse<View>>("GET", `/api/v2/meta/tables/${tableId}/views`);
  }

  /**
   * Creates a new view for a table.
   * 
   * @param tableId - ID of the table
   * @param body - View properties (title and type are required)
   * @returns Promise resolving to the created view
   * @throws {ValidationError} If the request data is invalid
   * 
   * @example
   * ```typescript
   * const view = await metaApi.createView('tbl_abc123', {
   *   title: 'Active Users',
   *   type: 'grid'
   * });
   * ```
   */
  createView(tableId: string, body: Partial<View>): Promise<View> {
    return this.client.request<View>("POST", `/api/v2/meta/tables/${tableId}/views`, { body });
  }

  /**
   * Gets detailed information about a specific view.
   * 
   * @param viewId - ID of the view to retrieve
   * @returns Promise resolving to the view details
   * @throws {NotFoundError} If the view doesn't exist
   * 
   * @example
   * ```typescript
   * const view = await metaApi.getView('vw_abc123');
   * ```
   */
  getView(viewId: string): Promise<View> {
    return this.client.request<View>("GET", `/api/v2/meta/views/${viewId}`);
  }

  /**
   * Updates a view's properties.
   * 
   * @param viewId - ID of the view to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated view
   * @throws {NotFoundError} If the view doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateView('vw_abc123', { title: 'New Title' });
   * ```
   */
  updateView(viewId: string, body: Partial<View>): Promise<View> {
    return this.client.request<View>("PATCH", `/api/v2/meta/views/${viewId}`, { body });
  }

  /**
   * Deletes a view permanently.
   * 
   * @param viewId - ID of the view to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the view doesn't exist
   * 
   * @example
   * ```typescript
   * await metaApi.deleteView('vw_abc123');
   * ```
   */
  deleteView(viewId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/views/${viewId}`);
  }

  /**
   * Lists all filters for a view.
   * 
   * @param viewId - ID of the view
   * @returns Promise resolving to paginated list of filters
   * @throws {NotFoundError} If the view doesn't exist
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listViewFilters('vw_abc123');
   * ```
   */
  listViewFilters(viewId: string): Promise<ListResponse<Filter>> {
    return this.client.request<ListResponse<Filter>>("GET", `/api/v2/meta/views/${viewId}/filters`);
  }

  /**
   * Creates a new filter for a view.
   * 
   * @param viewId - ID of the view
   * @param body - Filter properties
   * @returns Promise resolving to the created filter
   * @throws {ValidationError} If the request data is invalid
   * 
   * @example
   * ```typescript
   * const filter = await metaApi.createViewFilter('vw_abc123', {
   *   fk_column_id: 'col_xyz',
   *   comparison_op: 'eq',
   *   value: 'active'
   * });
   * ```
   */
  createViewFilter(viewId: string, body: Partial<Filter>): Promise<Filter> {
    return this.client.request<Filter>("POST", `/api/v2/meta/views/${viewId}/filters`, { body });
  }

  /**
   * Gets detailed information about a specific filter.
   * 
   * @param filterId - ID of the filter to retrieve
   * @returns Promise resolving to the filter details
   * @throws {NotFoundError} If the filter doesn't exist
   * 
   * @example
   * ```typescript
   * const filter = await metaApi.getFilter('flt_abc123');
   * ```
   */
  getFilter(filterId: string): Promise<Filter> {
    return this.client.request<Filter>("GET", `/api/v2/meta/filters/${filterId}`);
  }

  /**
   * Updates a filter's properties.
   * 
   * @param filterId - ID of the filter to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated filter
   * @throws {NotFoundError} If the filter doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateFilter('flt_abc123', { value: 'inactive' });
   * ```
   */
  updateFilter(filterId: string, body: Partial<Filter>): Promise<Filter> {
    return this.client.request<Filter>("PATCH", `/api/v2/meta/filters/${filterId}`, { body });
  }

  /**
   * Deletes a filter permanently.
   * 
   * @param filterId - ID of the filter to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the filter doesn't exist
   * 
   * @example
   * ```typescript
   * await metaApi.deleteFilter('flt_abc123');
   * ```
   */
  deleteFilter(filterId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/filters/${filterId}`);
  }

  /**
   * Lists all sorts for a view.
   * 
   * @param viewId - ID of the view
   * @returns Promise resolving to paginated list of sorts
   * @throws {NotFoundError} If the view doesn't exist
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listViewSorts('vw_abc123');
   * ```
   */
  listViewSorts(viewId: string): Promise<ListResponse<Sort>> {
    return this.client.request<ListResponse<Sort>>("GET", `/api/v2/meta/views/${viewId}/sorts`);
  }

  /**
   * Creates a new sort for a view.
   * 
   * @param viewId - ID of the view
   * @param body - Sort properties (fk_column_id and direction are required)
   * @returns Promise resolving to the created sort
   * @throws {ValidationError} If the request data is invalid
   * 
   * @example
   * ```typescript
   * const sort = await metaApi.createViewSort('vw_abc123', {
   *   fk_column_id: 'col_xyz',
   *   direction: 'asc'
   * });
   * ```
   */
  createViewSort(viewId: string, body: Partial<Sort>): Promise<Sort> {
    return this.client.request<Sort>("POST", `/api/v2/meta/views/${viewId}/sorts`, { body });
  }

  /**
   * Gets detailed information about a specific sort.
   * 
   * @param sortId - ID of the sort to retrieve
   * @returns Promise resolving to the sort details
   * @throws {NotFoundError} If the sort doesn't exist
   * 
   * @example
   * ```typescript
   * const sort = await metaApi.getSort('srt_abc123');
   * ```
   */
  getSort(sortId: string): Promise<Sort> {
    return this.client.request<Sort>("GET", `/api/v2/meta/sorts/${sortId}`);
  }

  /**
   * Updates a sort's properties.
   * 
   * @param sortId - ID of the sort to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated sort
   * @throws {NotFoundError} If the sort doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateSort('srt_abc123', { direction: 'desc' });
   * ```
   */
  updateSort(sortId: string, body: Partial<Sort>): Promise<Sort> {
    return this.client.request<Sort>("PATCH", `/api/v2/meta/sorts/${sortId}`, { body });
  }

  /**
   * Deletes a sort permanently.
   * 
   * @param sortId - ID of the sort to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the sort doesn't exist
   * 
   * @example
   * ```typescript
   * await metaApi.deleteSort('srt_abc123');
   * ```
   */
  deleteSort(sortId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/sorts/${sortId}`);
  }

  /**
   * Lists all columns for a table.
   * 
   * @param tableId - ID of the table
   * @returns Promise resolving to paginated list of columns
   * @throws {NotFoundError} If the table doesn't exist
   * 
   * @example
   * ```typescript
   * const response = await metaApi.listColumns('tbl_abc123');
   * for (const col of response.list) {
   *   console.log(`Column: ${col.title} (${col.uidt})`);
   * }
   * ```
   */
  listColumns(tableId: string): Promise<ListResponse<Column>> {
    return this.client.request<ListResponse<Column>>("GET", `/api/v2/meta/tables/${tableId}/columns`);
  }

  /**
   * Creates a new column in a table.
   * 
   * @param tableId - ID of the table
   * @param body - Column properties (title, column_name, and uidt are required)
   * @returns Promise resolving to the created column
   * @throws {ValidationError} If the request data is invalid
   * @throws {ConflictError} If a column with the same name already exists
   * 
   * @example
   * ```typescript
   * const column = await metaApi.createColumn('tbl_abc123', {
   *   title: 'Email',
   *   column_name: 'email',
   *   uidt: 'Email'
   * });
   * ```
   */
  createColumn(tableId: string, body: Partial<Column>): Promise<Column> {
    return this.client.request<Column>("POST", `/api/v2/meta/tables/${tableId}/columns`, { body });
  }

  /**
   * Gets detailed information about a specific column.
   * 
   * @param columnId - ID of the column to retrieve
   * @returns Promise resolving to the column details
   * @throws {NotFoundError} If the column doesn't exist
   * 
   * @example
   * ```typescript
   * const column = await metaApi.getColumn('col_abc123');
   * ```
   */
  getColumn(columnId: string): Promise<Column> {
    return this.client.request<Column>("GET", `/api/v2/meta/columns/${columnId}`);
  }

  /**
   * Updates a column's properties.
   * 
   * @param columnId - ID of the column to update
   * @param body - Properties to update
   * @returns Promise resolving to the updated column
   * @throws {NotFoundError} If the column doesn't exist
   * @throws {ValidationError} If the update data is invalid
   * 
   * @example
   * ```typescript
   * const updated = await metaApi.updateColumn('col_abc123', { title: 'New Title' });
   * ```
   */
  updateColumn(columnId: string, body: Partial<Column>): Promise<Column> {
    return this.client.request<Column>("PATCH", `/api/v2/meta/columns/${columnId}`, { body });
  }

  /**
   * Deletes a column permanently.
   * 
   * @param columnId - ID of the column to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {NotFoundError} If the column doesn't exist
   * 
   * @example
   * ```typescript
   * await metaApi.deleteColumn('col_abc123');
   * ```
   */
  deleteColumn(columnId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/api/v2/meta/columns/${columnId}`);
  }

  /**
   * Gets the Swagger/OpenAPI specification for a base.
   * 
   * Returns the complete API documentation for all tables and operations
   * in the specified base.
   * 
   * @param baseId - ID of the base
   * @returns Promise resolving to the Swagger document
   * @throws {NotFoundError} If the base doesn't exist
   * 
   * @example
   * ```typescript
   * const swagger = await metaApi.getBaseSwagger('base_abc123');
   * console.log(`API version: ${swagger.info.version}`);
   * ```
   */
  getBaseSwagger(baseId: string): Promise<unknown> {
    return this.client.request<unknown>("GET", `/api/v2/meta/bases/${baseId}/swagger.json`);
  }

  /**
   * Uploads a file attachment.
   * 
   * Uploads a file from the local filesystem to NocoDB storage.
   * The returned data can be used in attachment column fields.
   * 
   * @param filePath - Path to the file to upload
   * @returns Promise resolving to upload response with file metadata
   * @throws {ValidationError} If the file doesn't exist or is invalid
   * @throws {NetworkError} If the upload fails
   * 
   * @example
   * ```typescript
   * const result = await metaApi.uploadAttachment('/path/to/image.png');
   * // Use result in an attachment column
   * ```
   */
  async uploadAttachment(filePath: string): Promise<unknown> {
    const fileName = path.basename(filePath);
    const fileContent = await fs.promises.readFile(filePath);
    const boundary = `----nocodb-${Date.now()}`;
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), fileContent, Buffer.from(footer)]);
    return this.client.request<unknown>("POST", "/api/v2/storage/upload", {
      body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
  }
}

/**
 * API methods for data operations (links between records).
 *
 * Provides methods for managing relationships between records in linked tables.
 */
export class DataApi {
  constructor(private client: NocoClient) {}

  /**
   * List linked records for a specific record and link field.
   *
   * @param tableId - ID of the table containing the record
   * @param linkFieldId - ID of the link field (column)
   * @param recordId - ID of the record to get links for
   * @param query - Optional query parameters for filtering/pagination
   * @returns Paginated list of linked rows
   *
   * @example
   * ```typescript
   * const links = await dataApi.listLinks('tbl123', 'col456', 'rec789');
   * console.log(`Found ${links.pageInfo.totalRows} linked records`);
   * ```
   */
  listLinks(tableId: string, linkFieldId: string, recordId: string, query?: Record<string, any>): Promise<ListResponse<Row>> {
    return this.client.request("GET", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { query });
  }

  /**
   * Link records together via a link field.
   *
   * @param tableId - ID of the table containing the record
   * @param linkFieldId - ID of the link field (column)
   * @param recordId - ID of the record to link from
   * @param body - Array of record IDs or objects to link
   * @returns Success response
   *
   * @example
   * ```typescript
   * await dataApi.linkRecords('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
   * ```
   */
  linkRecords(tableId: string, linkFieldId: string, recordId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { body });
  }

  /**
   * Unlink records from a link field.
   *
   * @param tableId - ID of the table containing the record
   * @param linkFieldId - ID of the link field (column)
   * @param recordId - ID of the record to unlink from
   * @param body - Array of record IDs or objects to unlink
   * @returns Success response
   *
   * @example
   * ```typescript
   * await dataApi.unlinkRecords('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
   * ```
   */
  unlinkRecords(tableId: string, linkFieldId: string, recordId: string, body: unknown): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { body });
  }
}

/**
 * Normalizes a base URL by removing trailing slashes.
 * 
 * @param input - Base URL to normalize
 * @returns Normalized URL without trailing slashes
 * 
 * @example
 * ```typescript
 * normalizeBaseUrl('https://app.nocodb.com/') // 'https://app.nocodb.com'
 * normalizeBaseUrl('https://app.nocodb.com') // 'https://app.nocodb.com'
 * ```
 */
export function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

/**
 * Parses a header string in 'Name: Value' format.
 * 
 * @param input - Header string to parse
 * @returns Tuple of [name, value]
 * @throws {Error} If the header format is invalid
 * 
 * @example
 * ```typescript
 * const [name, value] = parseHeader('xc-token: my-api-token');
 * // name = 'xc-token', value = 'my-api-token'
 * ```
 */
export function parseHeader(input: string): [string, string] {
  const idx = input.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
  }
  const name = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!name || !value) {
    throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
  }
  return [name, value];
}
