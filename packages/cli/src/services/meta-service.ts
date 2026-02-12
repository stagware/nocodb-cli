import { NocoClient } from '@stagware/nocodb-sdk';
import { v3 } from '@stagware/nocodb-sdk';
import type {
  Base,
  Source,
  Table,
  View,
  ViewType,
  Column,
  Filter,
  Sort,
  Hook,
  ApiToken,
  BaseUser,
  Comment,
  SharedView,
  SharedBase,
  ViewColumn,
  FormView,
  GalleryView,
  KanbanView,
  GridView,
  AppInfo,
  VisibilityRule,
  DuplicateOptions,
  NcWorkspace,
  NcWorkspaceUser,
  ListResponse,
} from '@stagware/nocodb-sdk';

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
  // Source (Data Source) Operations
  // ============================================================================

  /**
   * List all data sources for a base.
   *
   * @param baseId - Base ID
   * @returns Paginated list of sources
   */
  async listSources(baseId: string): Promise<ListResponse<Source>> {
    return this.client.request<ListResponse<Source>>('GET', `/api/v2/meta/bases/${baseId}/sources`);
  }

  /**
   * Create a new data source in a base.
   *
   * @param baseId - Base ID
   * @param data - Source data (alias, type, config, etc.)
   * @returns Created source
   */
  async createSource(baseId: string, data: Partial<Source>): Promise<Source> {
    return this.client.request<Source>('POST', `/api/v2/meta/bases/${baseId}/sources`, { body: data });
  }

  /**
   * Get a data source by ID.
   *
   * @param baseId - Base ID
   * @param sourceId - Source ID
   * @returns Source details
   */
  async getSource(baseId: string, sourceId: string): Promise<Source> {
    return this.client.request<Source>('GET', `/api/v2/meta/bases/${baseId}/sources/${sourceId}`);
  }

  /**
   * Update a data source.
   *
   * @param baseId - Base ID
   * @param sourceId - Source ID
   * @param data - Updated source data
   * @returns Updated source
   */
  async updateSource(baseId: string, sourceId: string, data: Partial<Source>): Promise<Source> {
    return this.client.request<Source>('PATCH', `/api/v2/meta/bases/${baseId}/sources/${sourceId}`, { body: data });
  }

  /**
   * Delete a data source.
   *
   * @param baseId - Base ID
   * @param sourceId - Source ID
   */
  async deleteSource(baseId: string, sourceId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}/sources/${sourceId}`);
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
   * Delegates to v2 type-specific endpoints:
   * - Grid: POST /api/v2/meta/tables/{tableId}/grids
   * - Form: POST /api/v2/meta/tables/{tableId}/forms
   * - Gallery: POST /api/v2/meta/tables/{tableId}/galleries
   * - Kanban: POST /api/v2/meta/tables/{tableId}/kanbans
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
    switch (type) {
      case 'form':
        return this.createFormView(tableId, data);
      case 'gallery':
        return this.createGalleryView(tableId, data);
      case 'kanban':
        return this.createKanbanView(tableId, data);
      case 'grid':
        return this.createGridView(tableId, data);
      default:
        throw new Error(`Unsupported view type '${type}'. Use: grid, form, gallery, kanban`);
    }
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
  // Hook (Webhook) Operations
  // ============================================================================

  /**
   * List all hooks for a table.
   *
   * @param tableId - Table ID
   * @returns Paginated list of hooks
   */
  async listHooks(tableId: string): Promise<ListResponse<Hook>> {
    return this.client.request<ListResponse<Hook>>('GET', `/api/v2/meta/tables/${tableId}/hooks`);
  }

  /**
   * Create a new hook (webhook) for a table.
   *
   * @param tableId - Table ID
   * @param data - Hook data
   * @returns Created hook
   */
  async createHook(tableId: string, data: Partial<Hook>): Promise<Hook> {
    return this.client.request<Hook>('POST', `/api/v2/meta/tables/${tableId}/hooks`, { body: data });
  }

  /**
   * Get a hook by ID.
   *
   * @param hookId - Hook ID
   * @returns Hook details
   */
  async getHook(hookId: string): Promise<Hook> {
    return this.client.request<Hook>('GET', `/api/v2/meta/hooks/${hookId}`);
  }

  /**
   * Update a hook.
   *
   * @param hookId - Hook ID
   * @param data - Updated hook data
   * @returns Updated hook
   */
  async updateHook(hookId: string, data: Partial<Hook>): Promise<Hook> {
    return this.client.request<Hook>('PATCH', `/api/v2/meta/hooks/${hookId}`, { body: data });
  }

  /**
   * Delete a hook.
   *
   * @param hookId - Hook ID
   */
  async deleteHook(hookId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/hooks/${hookId}`);
  }

  /**
   * Test a hook by triggering a sample notification.
   *
   * @param hookId - Hook ID
   * @param data - Optional test payload
   * @returns Test result
   */
  async testHook(hookId: string, data?: Record<string, unknown>): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/hooks/${hookId}/test`, data ? { body: data } : {});
  }

  // ============================================================================
  // API Token Operations
  // ============================================================================

  /**
   * List all API tokens for a base.
   *
   * @param baseId - Base ID
   * @returns List of API tokens
   */
  async listTokens(baseId: string): Promise<ListResponse<ApiToken>> {
    return this.client.request<ListResponse<ApiToken>>('GET', `/api/v2/meta/bases/${baseId}/api-tokens`);
  }

  /**
   * Create a new API token for a base.
   *
   * @param baseId - Base ID
   * @param data - Token data (description is recommended)
   * @returns Created token (includes the token string)
   */
  async createToken(baseId: string, data: Partial<ApiToken>): Promise<ApiToken> {
    return this.client.request<ApiToken>('POST', `/api/v2/meta/bases/${baseId}/api-tokens`, { body: data });
  }

  /**
   * Delete an API token from a base.
   *
   * @param baseId - Base ID
   * @param tokenId - Token ID to delete
   */
  async deleteToken(baseId: string, tokenId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}/api-tokens/${tokenId}`);
  }

  // ============================================================================
  // Base User (Collaborator) Operations
  // ============================================================================

  /**
   * List all users (collaborators) for a base.
   *
   * @param baseId - Base ID
   * @returns List of base users
   */
  async listBaseUsers(baseId: string): Promise<ListResponse<BaseUser>> {
    return this.client.request<ListResponse<BaseUser>>('GET', `/api/v2/meta/bases/${baseId}/users`);
  }

  /**
   * Invite a user to a base.
   *
   * @param baseId - Base ID
   * @param data - User data (email and roles are required)
   * @returns Invite result
   */
  async inviteBaseUser(baseId: string, data: Partial<BaseUser>): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/bases/${baseId}/users`, { body: data });
  }

  /**
   * Update a user's role in a base.
   *
   * @param baseId - Base ID
   * @param userId - User ID
   * @param data - Updated user data (typically roles)
   * @returns Updated user
   */
  async updateBaseUser(baseId: string, userId: string, data: Partial<BaseUser>): Promise<unknown> {
    return this.client.request<unknown>('PATCH', `/api/v2/meta/bases/${baseId}/users/${userId}`, { body: data });
  }

  /**
   * Remove a user from a base.
   *
   * @param baseId - Base ID
   * @param userId - User ID
   */
  async removeBaseUser(baseId: string, userId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}/users/${userId}`);
  }

  // ============================================================================
  // Comment Operations
  // ============================================================================

  /**
   * List comments for a specific row.
   *
   * @param tableId - Table ID (fk_model_id)
   * @param rowId - Row ID
   * @returns List of comments
   */
  async listComments(tableId: string, rowId: string): Promise<ListResponse<Comment>> {
    return this.client.request<ListResponse<Comment>>('GET', '/api/v2/meta/comments', {
      query: { fk_model_id: tableId, row_id: rowId },
    });
  }

  /**
   * Create a comment on a row.
   *
   * @param data - Comment data (fk_model_id, row_id, comment are required)
   * @returns Created comment
   */
  async createComment(data: Partial<Comment>): Promise<Comment> {
    return this.client.request<Comment>('POST', '/api/v2/meta/comments', { body: data });
  }

  /**
   * Update a comment.
   *
   * @param commentId - Comment ID
   * @param data - Updated comment data
   * @returns Updated comment
   */
  async updateComment(commentId: string, data: Partial<Comment>): Promise<Comment> {
    return this.client.request<Comment>('PATCH', `/api/v2/meta/comment/${commentId}`, { body: data });
  }

  /**
   * Delete a comment.
   *
   * @param commentId - Comment ID
   */
  async deleteComment(commentId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/comment/${commentId}`);
  }

  // ============================================================================
  // Shared View Operations
  // ============================================================================

  /**
   * List shared views for a table.
   *
   * @param tableId - Table ID
   * @returns List of shared views
   */
  async listSharedViews(tableId: string): Promise<ListResponse<SharedView>> {
    return this.client.request<ListResponse<SharedView>>('GET', `/api/v2/meta/tables/${tableId}/share`);
  }

  /**
   * Create a shared view (public link) for a view.
   *
   * @param viewId - View ID
   * @param data - Optional shared view properties (password, meta)
   * @returns Created shared view
   */
  async createSharedView(viewId: string, data?: Partial<SharedView>): Promise<SharedView> {
    return this.client.request<SharedView>('POST', `/api/v2/meta/views/${viewId}/share`, data ? { body: data } : {});
  }

  /**
   * Update a shared view's properties.
   *
   * @param viewId - View ID whose share to update
   * @param data - Properties to update (password, meta)
   * @returns Updated shared view
   */
  async updateSharedView(viewId: string, data: Partial<SharedView>): Promise<SharedView> {
    return this.client.request<SharedView>('PATCH', `/api/v2/meta/views/${viewId}/share`, { body: data });
  }

  /**
   * Delete a shared view (remove public link).
   *
   * @param viewId - View ID whose share to delete
   */
  async deleteSharedView(viewId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/views/${viewId}/share`);
  }

  // ============================================================================
  // Shared Base Operations
  // ============================================================================

  /**
   * Get shared base info (uuid, url, roles).
   *
   * @param baseId - Base ID
   * @returns Shared base info
   */
  async getSharedBase(baseId: string): Promise<SharedBase> {
    return this.client.request<SharedBase>('GET', `/api/v2/meta/bases/${baseId}/shared`);
  }

  /**
   * Create a shared base (enable public sharing).
   *
   * @param baseId - Base ID
   * @param data - Shared base properties (roles, password)
   * @returns Created shared base
   */
  async createSharedBase(baseId: string, data?: Partial<SharedBase>): Promise<SharedBase> {
    return this.client.request<SharedBase>('POST', `/api/v2/meta/bases/${baseId}/shared`, data ? { body: data } : {});
  }

  /**
   * Update a shared base's properties.
   *
   * @param baseId - Base ID
   * @param data - Properties to update (roles, password)
   * @returns Updated shared base
   */
  async updateSharedBase(baseId: string, data: Partial<SharedBase>): Promise<SharedBase> {
    return this.client.request<SharedBase>('PATCH', `/api/v2/meta/bases/${baseId}/shared`, { body: data });
  }

  /**
   * Disable shared base (remove public sharing).
   *
   * @param baseId - Base ID
   */
  async deleteSharedBase(baseId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/bases/${baseId}/shared`);
  }

  // ============================================================================
  // View-Type-Specific Operations
  // ============================================================================

  /**
   * Create a grid view for a table (v2 endpoint).
   *
   * @param tableId - Table ID
   * @param data - View data (title is required)
   * @returns Created view
   */
  async createGridView(tableId: string, data: Partial<View>): Promise<View> {
    return this.client.request<View>('POST', `/api/v2/meta/tables/${tableId}/grids`, { body: data });
  }

  /**
   * Create a form view for a table (v2 endpoint).
   *
   * @param tableId - Table ID
   * @param data - View data (title is required)
   * @returns Created view
   */
  async createFormView(tableId: string, data: Partial<View>): Promise<View> {
    return this.client.request<View>('POST', `/api/v2/meta/tables/${tableId}/forms`, { body: data });
  }

  /**
   * Create a gallery view for a table (v2 endpoint).
   *
   * @param tableId - Table ID
   * @param data - View data (title is required)
   * @returns Created view
   */
  async createGalleryView(tableId: string, data: Partial<View>): Promise<View> {
    return this.client.request<View>('POST', `/api/v2/meta/tables/${tableId}/galleries`, { body: data });
  }

  /**
   * Create a kanban view for a table (v2 endpoint).
   *
   * @param tableId - Table ID
   * @param data - View data (title is required)
   * @returns Created view
   */
  async createKanbanView(tableId: string, data: Partial<View>): Promise<View> {
    return this.client.request<View>('POST', `/api/v2/meta/tables/${tableId}/kanbans`, { body: data });
  }

  /**
   * Creates a view in v3 (Unified endpoint).
   * 
   * @param baseId - Base ID
   * @param tableId - Table ID
   * @param view - View configuration
   * @returns Created view
   */
  async createViewV3(baseId: string, tableId: string, view: Partial<v3.ViewV3> & { type: v3.ViewTypeV3; title: string }): Promise<v3.ViewV3> {
    const api = new v3.MetaApiV3(this.client);
    return api.createView(baseId, tableId, view);
  }

  /**
   * Get form view-specific configuration.
   *
   * @param formViewId - Form view ID
   * @returns Form view config
   */
  async getFormView(formViewId: string): Promise<FormView> {
    return this.client.request<FormView>('GET', `/api/v2/meta/forms/${formViewId}`);
  }

  /**
   * Update form view-specific configuration.
   *
   * @param formViewId - Form view ID
   * @param data - Form-specific properties to update
   * @returns Updated form view config
   */
  async updateFormView(formViewId: string, data: Partial<FormView>): Promise<FormView> {
    return this.client.request<FormView>('PATCH', `/api/v2/meta/forms/${formViewId}`, { body: data });
  }

  /**
   * Get gallery view-specific configuration.
   *
   * @param galleryViewId - Gallery view ID
   * @returns Gallery view config
   */
  async getGalleryView(galleryViewId: string): Promise<GalleryView> {
    return this.client.request<GalleryView>('GET', `/api/v2/meta/galleries/${galleryViewId}`);
  }

  /**
   * Update gallery view-specific configuration.
   *
   * @param galleryViewId - Gallery view ID
   * @param data - Gallery-specific properties to update
   * @returns Updated gallery view config
   */
  async updateGalleryView(galleryViewId: string, data: Partial<GalleryView>): Promise<GalleryView> {
    return this.client.request<GalleryView>('PATCH', `/api/v2/meta/galleries/${galleryViewId}`, { body: data });
  }

  /**
   * Get kanban view-specific configuration.
   *
   * @param kanbanViewId - Kanban view ID
   * @returns Kanban view config
   */
  async getKanbanView(kanbanViewId: string): Promise<KanbanView> {
    return this.client.request<KanbanView>('GET', `/api/v2/meta/kanbans/${kanbanViewId}`);
  }

  /**
   * Update kanban view-specific configuration.
   *
   * @param kanbanViewId - Kanban view ID
   * @param data - Kanban-specific properties to update
   * @returns Updated kanban view config
   */
  async updateKanbanView(kanbanViewId: string, data: Partial<KanbanView>): Promise<KanbanView> {
    return this.client.request<KanbanView>('PATCH', `/api/v2/meta/kanbans/${kanbanViewId}`, { body: data });
  }

  /**
   * Update grid view-specific configuration.
   *
   * @param gridViewId - Grid view ID
   * @param data - Grid-specific properties to update
   * @returns Updated grid view config
   */
  async updateGridView(gridViewId: string, data: Partial<GridView>): Promise<GridView> {
    return this.client.request<GridView>('PATCH', `/api/v2/meta/grids/${gridViewId}`, { body: data });
  }

  /**
   * List columns for a view (field visibility/order settings).
   *
   * @param viewId - View ID
   * @returns List of view columns
   */
  async listViewColumns(viewId: string): Promise<ListResponse<ViewColumn>> {
    return this.client.request<ListResponse<ViewColumn>>('GET', `/api/v2/meta/views/${viewId}/columns`);
  }

  // ============================================================================
  // Filter Children (Nested Filter Groups)
  // ============================================================================

  /**
   * List child filters of a filter group.
   *
   * @param filterGroupId - Parent filter group ID
   * @returns List of child filters
   */
  async listFilterChildren(filterGroupId: string): Promise<ListResponse<Filter>> {
    return this.client.request<ListResponse<Filter>>('GET', `/api/v2/meta/filters/${filterGroupId}/children`);
  }

  // ============================================================================
  // Hook Filter Operations
  // ============================================================================

  /**
   * List filters for a hook (webhook).
   *
   * @param hookId - Hook ID
   * @returns List of hook filters
   */
  async listHookFilters(hookId: string): Promise<ListResponse<Filter>> {
    return this.client.request<ListResponse<Filter>>('GET', `/api/v2/meta/hooks/${hookId}/filters`);
  }

  /**
   * Create a filter for a hook (webhook).
   *
   * @param hookId - Hook ID
   * @param data - Filter data
   * @returns Created filter
   */
  async createHookFilter(hookId: string, data: Partial<Filter>): Promise<Filter> {
    return this.client.request<Filter>('POST', `/api/v2/meta/hooks/${hookId}/filters`, { body: data });
  }

  // ============================================================================
  // Column: Set Primary
  // ============================================================================

  /**
   * Set a column as the primary/display column for its table.
   *
   * @param columnId - Column ID
   * @returns Result
   */
  async setColumnPrimary(columnId: string): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/columns/${columnId}/primary`);
  }

  // ============================================================================
  // Duplicate Operations
  // ============================================================================

  /**
   * Duplicate a base.
   *
   * @param baseId - Base ID
   * @param options - Optional duplicate options
   * @returns Duplicate operation result
   */
  async duplicateBase(baseId: string, options?: DuplicateOptions): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/duplicate/${baseId}`, options ? { body: { options } } : {});
  }

  /**
   * Duplicate a base source.
   *
   * @param baseId - Base ID
   * @param sourceId - Source ID
   * @param options - Optional duplicate options
   * @returns Duplicate operation result
   */
  async duplicateSource(baseId: string, sourceId: string, options?: DuplicateOptions): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/duplicate/${baseId}/${sourceId}`, options ? { body: { options } } : {});
  }

  /**
   * Duplicate a table within a base.
   *
   * @param baseId - Base ID
   * @param tableId - Table ID
   * @param options - Optional duplicate options
   * @returns Duplicate operation result
   */
  async duplicateTable(baseId: string, tableId: string, options?: DuplicateOptions): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/duplicate/${baseId}/table/${tableId}`, options ? { body: { options } } : {});
  }

  // ============================================================================
  // Visibility Rules (UI ACL)
  // ============================================================================

  /**
   * Get view visibility rules for a base (UI ACL).
   *
   * @param baseId - Base ID
   * @returns Visibility rules
   */
  async getVisibilityRules(baseId: string): Promise<VisibilityRule[]> {
    return this.client.request<VisibilityRule[]>('GET', `/api/v2/meta/bases/${baseId}/visibility-rules`);
  }

  /**
   * Set view visibility rules for a base (UI ACL).
   *
   * @param baseId - Base ID
   * @param data - Visibility rules to set
   * @returns Result
   */
  async setVisibilityRules(baseId: string, data: VisibilityRule[]): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/bases/${baseId}/visibility-rules`, { body: data });
  }

  // ============================================================================
  // App Info
  // ============================================================================

  /**
   * Get NocoDB server application info (version, etc.).
   *
   * @returns App info
   */
  async getAppInfo(): Promise<AppInfo> {
    return this.client.request<AppInfo>('GET', '/api/v2/meta/nocodb/info');
  }

  // ============================================================================
  // Cloud Workspace Operations (☁ cloud-only)
  // ============================================================================

  /**
   * List all workspaces (☁ cloud-only).
   *
   * @returns Paginated list of workspaces
   */
  async listWorkspaces(): Promise<ListResponse<NcWorkspace>> {
    return this.client.request<ListResponse<NcWorkspace>>('GET', '/api/v2/meta/workspaces');
  }

  /**
   * Get a workspace by ID (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @returns Workspace details and user count
   */
  async getWorkspace(workspaceId: string): Promise<{ workspace: NcWorkspace; workspaceUserCount: number }> {
    return this.client.request<{ workspace: NcWorkspace; workspaceUserCount: number }>('GET', `/api/v2/meta/workspaces/${workspaceId}`);
  }

  /**
   * Create a new workspace (☁ cloud-only).
   *
   * @param data - Workspace data (title is required)
   * @returns Created workspace
   */
  async createWorkspace(data: Partial<NcWorkspace>): Promise<NcWorkspace> {
    return this.client.request<NcWorkspace>('POST', '/api/v2/meta/workspaces', { body: data });
  }

  /**
   * Update a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param data - Properties to update
   */
  async updateWorkspace(workspaceId: string, data: Partial<NcWorkspace>): Promise<void> {
    return this.client.request<void>('PATCH', `/api/v2/meta/workspaces/${workspaceId}`, { body: data });
  }

  /**
   * Delete a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/workspaces/${workspaceId}`);
  }

  /**
   * List users in a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @returns List of workspace users
   */
  async listWorkspaceUsers(workspaceId: string): Promise<ListResponse<NcWorkspaceUser>> {
    return this.client.request<ListResponse<NcWorkspaceUser>>('GET', `/api/v2/meta/workspaces/${workspaceId}/users`);
  }

  /**
   * Get a specific user in a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @returns Workspace user details
   */
  async getWorkspaceUser(workspaceId: string, userId: string): Promise<NcWorkspaceUser> {
    return this.client.request<NcWorkspaceUser>('GET', `/api/v2/meta/workspaces/${workspaceId}/users/${userId}`);
  }

  /**
   * Invite a user to a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param data - Invite data (email and roles are required)
   * @returns Invite result
   */
  async inviteWorkspaceUser(workspaceId: string, data: Partial<NcWorkspaceUser>): Promise<unknown> {
    return this.client.request<unknown>('POST', `/api/v2/meta/workspaces/${workspaceId}/invitations`, { body: data });
  }

  /**
   * Update a user's role in a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @param data - Properties to update (typically roles)
   */
  async updateWorkspaceUser(workspaceId: string, userId: string, data: Partial<NcWorkspaceUser>): Promise<void> {
    return this.client.request<void>('PATCH', `/api/v2/meta/workspaces/${workspaceId}/users/${userId}`, { body: data });
  }

  /**
   * Remove a user from a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   */
  async deleteWorkspaceUser(workspaceId: string, userId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/api/v2/meta/workspaces/${workspaceId}/users/${userId}`);
  }

  /**
   * List bases in a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @returns Paginated list of bases
   */
  async listWorkspaceBases(workspaceId: string): Promise<ListResponse<Base>> {
    return this.client.request<ListResponse<Base>>('GET', `/api/v2/meta/workspaces/${workspaceId}/bases`);
  }

  /**
   * Create a base in a workspace (☁ cloud-only).
   *
   * @param workspaceId - Workspace ID
   * @param data - Base data (title is required)
   * @returns Created base
   */
  async createWorkspaceBase(workspaceId: string, data: Partial<Base>): Promise<Base> {
    return this.client.request<Base>('POST', `/api/v2/meta/workspaces/${workspaceId}/bases`, { body: data });
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
    const { MetaApi } = await import('@stagware/nocodb-sdk');
    const metaApi = new MetaApi(this.client);
    return metaApi.uploadAttachment(filePath);
  }
}
