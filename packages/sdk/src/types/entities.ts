/**
 * Type definitions for NocoDB API entities.
 * 
 * This module provides TypeScript interfaces for all core NocoDB entities
 * including bases, tables, views, columns, filters, sorts, and rows.
 */

/**
 * Represents a NocoDB base (database/project).
 */
export interface Base {
  /** Unique identifier for the base */
  id: string;
  /** Display title of the base */
  title: string;
  /** Type of the base (e.g., 'database') */
  type?: string;
  /** Whether this is a meta base */
  is_meta?: boolean;
  /** Base description */
  description?: string;
  /** Base color (hex string) */
  color?: string;
  /** Display order of the base */
  order?: number;
  /** Base status */
  status?: string;
  /** Table name prefix */
  prefix?: string;
  /** Whether the base is deleted (soft delete) */
  deleted?: boolean;
  /** Additional metadata */
  meta?: Record<string, unknown> | string | null;
  /** Data sources associated with this base */
  sources?: Source[];
  /** Whether the base is external */
  external?: boolean;
  /** Timestamp when the base was created */
  created_at?: string;
  /** Timestamp when the base was last updated */
  updated_at?: string;
}

/**
 * Supported source/connection types in NocoDB.
 */
export type SourceType = 'mysql2' | 'pg' | 'sqlite3' | 'mssql' | 'snowflake' | 'databricks';

/**
 * Represents a data source (database connection) within a NocoDB base.
 */
export interface Source {
  /** Unique identifier for the source */
  id: string;
  /** ID of the base this source belongs to */
  base_id: string;
  /** Display alias for the source */
  alias?: string;
  /** Source type (database driver) */
  type?: SourceType | string;
  /** Whether the source is enabled */
  enabled?: boolean;
  /** Whether this is the meta source */
  is_meta?: boolean;
  /** Connection configuration (encrypted) */
  config?: Record<string, unknown> | string | null;
  /** Column name inflection rule */
  inflection_column?: string;
  /** Table name inflection rule */
  inflection_table?: string;
  /** Display order of the source */
  order?: number;
  /** Additional metadata */
  meta?: Record<string, unknown> | string | null;
  /** Timestamp when the source was created */
  created_at?: string;
  /** Timestamp when the source was last updated */
  updated_at?: string;
}

/**
 * Represents a table within a NocoDB base.
 */
export interface Table {
  /** Unique identifier for the table */
  id: string;
  /** ID of the base this table belongs to */
  base_id: string;
  /** Display title of the table */
  title: string;
  /** Actual database table name */
  table_name: string;
  /** Type of the table */
  type?: string;
  /** Whether the table is enabled */
  enabled?: boolean;
  /** Display order of the table */
  order?: number;
  /** Columns in this table */
  columns?: Column[];
  /** Timestamp when the table was created */
  created_at?: string;
  /** Timestamp when the table was last updated */
  updated_at?: string;
}

/**
 * Supported view types in NocoDB.
 */
export type ViewType = 'grid' | 'form' | 'gallery' | 'kanban' | 'calendar';

/**
 * Represents a view of a table (grid, form, gallery, etc.).
 */
export interface View {
  /** Unique identifier for the view */
  id: string;
  /** Display title of the view */
  title: string;
  /** Type of the view */
  type: ViewType;
  /** ID of the table this view belongs to */
  fk_model_id: string;
  /** Whether the view is visible */
  show?: boolean;
  /** Display order of the view */
  order?: number;
  /** Timestamp when the view was created */
  created_at?: string;
  /** Timestamp when the view was last updated */
  updated_at?: string;
}

/**
 * Supported column types in NocoDB.
 * 
 * Includes basic types (text, number, date), advanced types (formula, lookup),
 * and special types (attachments, links).
 */
export type ColumnType = 
  | 'SingleLineText' | 'LongText' | 'Number' | 'Decimal'
  | 'Currency' | 'Percent' | 'Duration' | 'Rating'
  | 'Date' | 'DateTime' | 'Time' | 'Year'
  | 'Checkbox' | 'SingleSelect' | 'MultiSelect'
  | 'Email' | 'URL' | 'PhoneNumber'
  | 'LinkToAnotherRecord' | 'Lookup' | 'Rollup' | 'Formula'
  | 'Attachment' | 'Barcode' | 'QrCode' | 'JSON';

/**
 * Represents a column in a table.
 */
export interface Column {
  /** Unique identifier for the column */
  id: string;
  /** Display title of the column */
  title: string;
  /** Actual database column name */
  column_name: string;
  /** UI data type of the column */
  uidt: ColumnType;
  /** Database data type */
  dt?: string;
  /** Whether this is a primary key column */
  pk?: boolean;
  /** Whether this is a primary value column */
  pv?: boolean;
  /** Whether this column is required */
  rqd?: boolean;
  /** Whether this is a system column */
  system?: boolean;
  /** ID of the table this column belongs to */
  fk_model_id: string;
  /** Timestamp when the column was created */
  created_at?: string;
  /** Timestamp when the column was last updated */
  updated_at?: string;
}

/**
 * Comparison operators for filter conditions.
 * 
 * Includes equality, comparison, pattern matching, and set operations.
 */
export type ComparisonOperator =
  | 'eq' | 'neq' | 'like' | 'nlike' | 'empty' | 'notempty'
  | 'null' | 'notnull' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'allof' | 'anyof' | 'nallof' | 'nanyof';

/**
 * Represents a filter condition on a view.
 * 
 * Filters can be simple conditions or groups of conditions combined with
 * logical operators (AND/OR).
 */
export interface Filter {
  /** Unique identifier for the filter */
  id: string;
  /** ID of the view this filter belongs to */
  fk_view_id: string;
  /** ID of the column to filter on (not set for filter groups) */
  fk_column_id?: string;
  /** Logical operator for combining filters (and/or) */
  logical_op?: 'and' | 'or';
  /** Comparison operator for the filter condition */
  comparison_op?: ComparisonOperator;
  /** Value to compare against */
  value?: string | number | boolean | null;
  /** ID of the parent filter group (for nested filters) */
  fk_parent_id?: string;
  /** Whether this is a filter group */
  is_group?: boolean;
  /** Timestamp when the filter was created */
  created_at?: string;
  /** Timestamp when the filter was last updated */
  updated_at?: string;
}

/**
 * Represents a sort order on a view.
 */
export interface Sort {
  /** Unique identifier for the sort */
  id: string;
  /** ID of the view this sort belongs to */
  fk_view_id: string;
  /** ID of the column to sort by */
  fk_column_id: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Order of this sort in the sort list */
  order?: number;
  /** Timestamp when the sort was created */
  created_at?: string;
  /** Timestamp when the sort was last updated */
  updated_at?: string;
}

/**
 * Represents a webhook/hook on a table.
 */
export interface Hook {
  /** Unique identifier for the hook */
  id: string;
  /** ID of the table this hook belongs to */
  fk_model_id: string;
  /** Display title of the hook */
  title: string;
  /** Description of the hook */
  description?: string;
  /** Event type (after/before) */
  event: 'after' | 'before';
  /** Operation that triggers the hook */
  operation: 'insert' | 'update' | 'delete' | 'bulkInsert' | 'bulkUpdate' | 'bulkDelete';
  /** Whether the hook is active */
  active?: boolean;
  /** Notification configuration (URL, method, headers, body, etc.) */
  notification?: Record<string, unknown>;
  /** Retry count on failure */
  retries?: number;
  /** Retry interval in milliseconds */
  retry_interval?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Timestamp when the hook was created */
  created_at?: string;
  /** Timestamp when the hook was last updated */
  updated_at?: string;
}

/**
 * Represents an API token.
 */
export interface ApiToken {
  /** Unique identifier for the token */
  id?: string;
  /** Token string */
  token?: string;
  /** Description/label for the token */
  description?: string;
  /** ID of the user who created the token */
  fk_user_id?: string;
  /** Timestamp when the token was created */
  created_at?: string;
  /** Timestamp when the token was last updated */
  updated_at?: string;
}

/**
 * Represents a user associated with a base (collaborator).
 */
export interface BaseUser {
  /** Unique identifier for the user */
  id?: string;
  /** User email address */
  email: string;
  /** User display name */
  display_name?: string;
  /** User role in the base */
  roles?: string;
  /** Timestamp when the user was created */
  created_at?: string;
  /** Timestamp when the user was last updated */
  updated_at?: string;
}

/**
 * Represents a row of data in a table.
 * 
 * Rows have an Id field and arbitrary additional fields based on the table schema.
 */
export interface Row {
  /** Unique identifier for the row (may be string or number depending on PK type) */
  Id?: string | number;
  /** Additional fields based on table columns */
  [key: string]: unknown;
}
