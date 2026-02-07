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
  /** Timestamp when the base was created */
  created_at?: string;
  /** Timestamp when the base was last updated */
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
