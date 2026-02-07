import { NocoClient } from '@nocodb/sdk';
import type {
  Base,
  Table,
  View,
  ViewType,
  Column,
  Filter,
  Sort,
  ListResponse,
} from '@nocodb/sdk';

/**
 * Service for managing NocoDB metadata operations.
 * 
 * Provides high-level methods for CRUD operations on bases, tables, views,
 * columns, filters, and sorts. Delegates to the SDK NocoClient for actual API calls.
 * 
 * @example
 * ```typescript
 * const metaService = new MetaService(nocoClient);
 * 
 * // List all bases
 * const bases = await metaService.listBases();
 * 
 * // Create a new table
 * const table = await metaService.createTable('base123', {
 *   title: 'My Table',
 *   table_name: 'my_table'
 * });
 * ```
 */
export class MetaService {
  private client: NocoClient;

  /**
   * Creates a new MetaService instance.
   * 
   * @param client - NocoClient instance for making API requests
   */
  constructor(client: NocoClient) {
    this.client = client;
  }

  // ============================================================================
  // Base Operations
  // ============================================================================

  /**
   * List all bases accessible to the authenticated user.
   * 
   * @returns Paginated list of bases
   * 
   * @example
   * ```typescript
   * const result = await metaService.listBases();
   * console.log(`Found ${result.list.length} bases`);
   * ```
   */
  async listBases(): Promise<ListResponse<Base>> {
    return this.client.request<ListResponse<Base>>('GET', '/api/v2/meta/bases');
  }

  /**
   * Create a new base.
   * 
   * @param data - Base data (title, type, etc.)
   * @returns Created base
   * 
   * @example
   * ```typescript
   * const base = await metaService.createBase({
   *   title: 'My Project',
   *   type: 'database'
   * });
   * ```
   */
  async createBase(data: Partial<Base>): Promise<Base> {
    return this.client.request<Base>('POST', '/api/v2/meta/bases', { body: data });
  }

  /**
   * Get a base by ID.
   * 
   * @param baseId - Base ID
   * @returns Base details
   * 
   * @example
   * ```typescript
   * const base = await metaService.getBase('base123');
   * console.log(base.title);
   * ```
   */
  async getBase(baseId: string): Promise<Base> {
    return this.client.request<Base>('GET', `/api/v2/meta/bases/${baseId}`);
  }

  /**
   * Get base info (metadata) by ID.
   * 
   * @param baseId - Base ID
   * @returns Base info
   * 
   * @example
   * ```typescript
   * const info = await metaService.getBaseInfo('base123');
   * ```
   */
  async getBaseInfo(baseId: string): Promise<Base> {
    return this.client.request<Base>('GET', `/api/v2/meta/bases/${baseId}/info`);
  }

  /**
   * Update a base.
   * 
   * @param baseId - Base ID
   * @param data - Updated base data
   * @returns Updated base
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateBase('base123', {
   *   title: 'Renamed Project'
   * });
   * ```
   */
  async updateBase(baseId: string, data: Partial<Base>): Promise<Base> {
    return this.client.request<Base>('PATCH', `/api/v2/meta/bases/${baseId}`, { body: data });
  }

  /**
   * Delete a base.
   * 
   * @param baseId - Base ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteBase('base123');
   * ```
   */
  async deleteBase(baseId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}`);
  }

  // ============================================================================
  // Table Operations
  // ============================================================================

  /**
   * List all tables in a base.
   * 
   * @param baseId - Base ID
   * @returns Paginated list of tables
   * 
   * @example
   * ```typescript
   * const result = await metaService.listTables('base123');
   * console.log(`Found ${result.list.length} tables`);
   * ```
   */
  async listTables(baseId: string): Promise<ListResponse<Table>> {
    return this.client.request<ListResponse<Table>>('GET', `/api/v2/meta/bases/${baseId}/tables`);
  }

  /**
   * Create a new table in a base.
   * 
   * @param baseId - Base ID
   * @param data - Table data (title, table_name, columns, etc.)
   * @returns Created table
   * 
   * @example
   * ```typescript
   * const table = await metaService.createTable('base123', {
   *   title: 'Users',
   *   table_name: 'users',
   *   columns: [
   *     { title: 'Name', column_name: 'name', uidt: 'SingleLineText' }
   *   ]
   * });
   * ```
   */
  async createTable(baseId: string, data: Partial<Table>): Promise<Table> {
    return this.client.request<Table>('POST', `/api/v2/meta/bases/${baseId}/tables`, { body: data });
  }

  /**
   * Get a table by ID.
   * 
   * @param tableId - Table ID
   * @returns Table details including columns
   * 
   * @example
   * ```typescript
   * const table = await metaService.getTable('tbl123');
   * console.log(`Table has ${table.columns?.length} columns`);
   * ```
   */
  async getTable(tableId: string): Promise<Table> {
    return this.client.request<Table>('GET', `/api/v2/meta/tables/${tableId}`);
  }

  /**
   * Update a table.
   * 
   * @param tableId - Table ID
   * @param data - Updated table data
   * @returns Updated table
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateTable('tbl123', {
   *   title: 'Renamed Table'
   * });
   * ```
   */
  async updateTable(tableId: string, data: Partial<Table>): Promise<Table> {
    return this.client.request<Table>('PATCH', `/api/v2/meta/tables/${tableId}`, { body: data });
  }

  /**
   * Delete a table.
   * 
   * @param tableId - Table ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteTable('tbl123');
   * ```
   */
  async deleteTable(tableId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/tables/${tableId}`);
  }

  // ============================================================================
  // View Operations
  // ============================================================================

  /**
   * List all views in a table.
   * 
   * @param tableId - Table ID
   * @returns Paginated list of views
   * 
   * @example
   * ```typescript
   * const result = await metaService.listViews('tbl123');
   * console.log(`Found ${result.list.length} views`);
   * ```
   */
  async listViews(tableId: string): Promise<ListResponse<View>> {
    return this.client.request<ListResponse<View>>('GET', `/api/v2/meta/tables/${tableId}/views`);
  }

  /**
   * Create a new view in a table.
   * 
   * NocoDB uses type-specific v1 endpoints for view creation:
   * - Grid: POST /api/v1/db/meta/tables/{tableId}/grids
   * - Form: POST /api/v1/db/meta/tables/{tableId}/forms
   * - Gallery: POST /api/v1/db/meta/tables/{tableId}/galleries
   * - Kanban: POST /api/v1/db/meta/tables/{tableId}/kanbans
   * - Calendar: POST /api/v1/db/meta/tables/{tableId}/calendars
   * 
   * @param tableId - Table ID
   * @param data - View data (title, etc.)
   * @param type - View type (defaults to 'grid')
   * @returns Created view
   * 
   * @example
   * ```typescript
   * const view = await metaService.createView('tbl123', {
   *   title: 'Active Users',
   * }, 'grid');
   * ```
   */
  async createView(tableId: string, data: Partial<View>, type: ViewType = 'grid'): Promise<View> {
    const typeToEndpoint: Record<string, string> = {
      grid: 'grids',
      form: 'forms',
      gallery: 'galleries',
      kanban: 'kanbans',
      calendar: 'calendars',
    };
    const endpoint = typeToEndpoint[type] || 'grids';
    return this.client.request<View>('POST', `/api/v1/db/meta/tables/${tableId}/${endpoint}`, { body: data });
  }

  /**
   * Get a view by ID.
   * 
   * NocoDB does not provide a direct GET endpoint for a single view.
   * This method lists all views for the given table and filters by viewId.
   * 
   * @param tableId - Table ID that contains the view
   * @param viewId - View ID to find
   * @returns View details
   * @throws {Error} If the view is not found in the table
   * 
   * @example
   * ```typescript
   * const view = await metaService.getView('tbl123', 'view456');
   * console.log(view.type); // 'grid', 'form', 'gallery', etc.
   * ```
   */
  async getView(tableId: string, viewId: string): Promise<View> {
    const result = await this.listViews(tableId);
    const view = result.list.find((v) => v.id === viewId);
    if (!view) {
      throw new Error(`View '${viewId}' not found in table '${tableId}'`);
    }
    return view;
  }

  /**
   * Update a view.
   * 
   * @param viewId - View ID
   * @param data - Updated view data
   * @returns Updated view
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateView('view123', {
   *   title: 'Renamed View'
   * });
   * ```
   */
  async updateView(viewId: string, data: Partial<View>): Promise<View> {
    return this.client.request<View>('PATCH', `/api/v2/meta/views/${viewId}`, { body: data });
  }

  /**
   * Delete a view.
   * 
   * @param viewId - View ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteView('view123');
   * ```
   */
  async deleteView(viewId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/views/${viewId}`);
  }

  // ============================================================================
  // Column Operations
  // ============================================================================

  /**
   * List all columns in a table.
   * 
   * @param tableId - Table ID
   * @returns Paginated list of columns
   * 
   * @example
   * ```typescript
   * const result = await metaService.listColumns('tbl123');
   * console.log(`Found ${result.list.length} columns`);
   * ```
   */
  async listColumns(tableId: string): Promise<ListResponse<Column>> {
    return this.client.request<ListResponse<Column>>('GET', `/api/v2/meta/tables/${tableId}/columns`);
  }

  /**
   * Create a new column in a table.
   * 
   * @param tableId - Table ID
   * @param data - Column data (title, column_name, uidt, etc.)
   * @returns Created column
   * 
   * @example
   * ```typescript
   * const column = await metaService.createColumn('tbl123', {
   *   title: 'Email',
   *   column_name: 'email',
   *   uidt: 'Email'
   * });
   * ```
   */
  async createColumn(tableId: string, data: Partial<Column>): Promise<Column> {
    return this.client.request<Column>('POST', `/api/v2/meta/tables/${tableId}/columns`, { body: data });
  }

  /**
   * Get a column by ID.
   * 
   * @param columnId - Column ID
   * @returns Column details
   * 
   * @example
   * ```typescript
   * const column = await metaService.getColumn('col123');
   * console.log(column.uidt); // Column type
   * ```
   */
  async getColumn(columnId: string): Promise<Column> {
    return this.client.request<Column>('GET', `/api/v2/meta/columns/${columnId}`);
  }

  /**
   * Update a column.
   * 
   * @param columnId - Column ID
   * @param data - Updated column data
   * @returns Updated column
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateColumn('col123', {
   *   title: 'Renamed Column'
   * });
   * ```
   */
  async updateColumn(columnId: string, data: Partial<Column>): Promise<Column> {
    return this.client.request<Column>('PATCH', `/api/v2/meta/columns/${columnId}`, { body: data });
  }

  /**
   * Delete a column.
   * 
   * @param columnId - Column ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteColumn('col123');
   * ```
   */
  async deleteColumn(columnId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/columns/${columnId}`);
  }

  // ============================================================================
  // Filter Operations
  // ============================================================================

  /**
   * List all filters in a view.
   * 
   * @param viewId - View ID
   * @returns Paginated list of filters
   * 
   * @example
   * ```typescript
   * const result = await metaService.listViewFilters('view123');
   * console.log(`Found ${result.list.length} filters`);
   * ```
   */
  async listViewFilters(viewId: string): Promise<ListResponse<Filter>> {
    return this.client.request<ListResponse<Filter>>('GET', `/api/v2/meta/views/${viewId}/filters`);
  }

  /**
   * Create a new filter in a view.
   * 
   * @param viewId - View ID
   * @param data - Filter data (fk_column_id, comparison_op, value, etc.)
   * @returns Created filter
   * 
   * @example
   * ```typescript
   * const filter = await metaService.createViewFilter('view123', {
   *   fk_column_id: 'col123',
   *   comparison_op: 'eq',
   *   value: 'active'
   * });
   * ```
   */
  async createViewFilter(viewId: string, data: Partial<Filter>): Promise<Filter> {
    return this.client.request<Filter>('POST', `/api/v2/meta/views/${viewId}/filters`, { body: data });
  }

  /**
   * Get a filter by ID.
   * 
   * @param filterId - Filter ID
   * @returns Filter details
   * 
   * @example
   * ```typescript
   * const filter = await metaService.getFilter('flt123');
   * console.log(filter.comparison_op);
   * ```
   */
  async getFilter(filterId: string): Promise<Filter> {
    return this.client.request<Filter>('GET', `/api/v2/meta/filters/${filterId}`);
  }

  /**
   * Update a filter.
   * 
   * @param filterId - Filter ID
   * @param data - Updated filter data
   * @returns Updated filter
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateFilter('flt123', {
   *   value: 'inactive'
   * });
   * ```
   */
  async updateFilter(filterId: string, data: Partial<Filter>): Promise<Filter> {
    return this.client.request<Filter>('PATCH', `/api/v2/meta/filters/${filterId}`, { body: data });
  }

  /**
   * Delete a filter.
   * 
   * @param filterId - Filter ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteFilter('flt123');
   * ```
   */
  async deleteFilter(filterId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/filters/${filterId}`);
  }

  // ============================================================================
  // Sort Operations
  // ============================================================================

  /**
   * List all sorts in a view.
   * 
   * @param viewId - View ID
   * @returns Paginated list of sorts
   * 
   * @example
   * ```typescript
   * const result = await metaService.listViewSorts('view123');
   * console.log(`Found ${result.list.length} sorts`);
   * ```
   */
  async listViewSorts(viewId: string): Promise<ListResponse<Sort>> {
    return this.client.request<ListResponse<Sort>>('GET', `/api/v2/meta/views/${viewId}/sorts`);
  }

  /**
   * Create a new sort in a view.
   * 
   * @param viewId - View ID
   * @param data - Sort data (fk_column_id, direction, etc.)
   * @returns Created sort
   * 
   * @example
   * ```typescript
   * const sort = await metaService.createViewSort('view123', {
   *   fk_column_id: 'col123',
   *   direction: 'asc'
   * });
   * ```
   */
  async createViewSort(viewId: string, data: Partial<Sort>): Promise<Sort> {
    return this.client.request<Sort>('POST', `/api/v2/meta/views/${viewId}/sorts`, { body: data });
  }

  /**
   * Get a sort by ID.
   * 
   * @param sortId - Sort ID
   * @returns Sort details
   * 
   * @example
   * ```typescript
   * const sort = await metaService.getSort('srt123');
   * console.log(sort.direction); // 'asc' or 'desc'
   * ```
   */
  async getSort(sortId: string): Promise<Sort> {
    return this.client.request<Sort>('GET', `/api/v2/meta/sorts/${sortId}`);
  }

  /**
   * Update a sort.
   * 
   * @param sortId - Sort ID
   * @param data - Updated sort data
   * @returns Updated sort
   * 
   * @example
   * ```typescript
   * const updated = await metaService.updateSort('srt123', {
   *   direction: 'desc'
   * });
   * ```
   */
  async updateSort(sortId: string, data: Partial<Sort>): Promise<Sort> {
    return this.client.request<Sort>('PATCH', `/api/v2/meta/sorts/${sortId}`, { body: data });
  }

  /**
   * Delete a sort.
   * 
   * @param sortId - Sort ID
   * 
   * @example
   * ```typescript
   * await metaService.deleteSort('srt123');
   * ```
   */
  async deleteSort(sortId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/sorts/${sortId}`);
  }

  // ============================================================================
  // Swagger Operations
  // ============================================================================

  /**
   * Get the Swagger/OpenAPI specification for a base.
   * 
   * @param baseId - Base ID
   * @returns Swagger document
   * 
   * @example
   * ```typescript
   * const swagger = await metaService.getBaseSwagger('base123');
   * console.log(swagger.paths);
   * ```
   */
  async getBaseSwagger(baseId: string): Promise<unknown> {
    return this.client.request<unknown>('GET', `/api/v2/meta/bases/${baseId}/swagger.json`);
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Upload an attachment file.
   * 
   * Note: This method requires file system access and is primarily for CLI usage.
   * For programmatic usage, consider using the SDK's MetaApi.uploadAttachment directly.
   * 
   * @param filePath - Path to the file to upload
   * @returns Upload response with file metadata
   * 
   * @example
   * ```typescript
   * const result = await metaService.uploadAttachment('./photo.jpg');
   * console.log(result);
   * ```
   */
  async uploadAttachment(filePath: string): Promise<unknown> {
    // Note: This delegates to MetaApi which handles the multipart form data
    // We need to import MetaApi for this specific operation
    const { MetaApi } = await import('@nocodb/sdk');
    const metaApi = new MetaApi(this.client);
    return metaApi.uploadAttachment(filePath);
  }
}
