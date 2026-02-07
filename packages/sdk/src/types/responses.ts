/**
 * Type definitions for NocoDB API responses.
 * 
 * This module provides TypeScript interfaces for API response structures
 * including paginated lists, bulk operations, and error responses.
 */

import type { Row } from './entities.js';

/**
 * Pagination metadata for list responses.
 * 
 * Provides information about the current page, total rows, and navigation state.
 */
export interface PageInfo {
  /** Total number of rows across all pages */
  totalRows?: number;
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Whether this is the first page */
  isFirstPage?: boolean;
  /** Whether this is the last page */
  isLastPage?: boolean;
}

/**
 * Generic paginated list response.
 * 
 * Used for endpoints that return lists of items with pagination support.
 * 
 * @template T - The type of items in the list
 * 
 * @example
 * ```typescript
 * const response: ListResponse<Table> = await client.listTables(baseId);
 * console.log(`Found ${response.pageInfo.totalRows} tables`);
 * for (const table of response.list) {
 *   console.log(table.title);
 * }
 * ```
 */
export interface ListResponse<T> {
  /** Array of items in the current page */
  list: T[];
  /** Pagination metadata */
  pageInfo: PageInfo;
}

/**
 * Response from bulk create operations.
 * 
 * Indicates how many rows were successfully created and optionally
 * includes the created row data.
 */
export interface BulkCreateResponse {
  /** Number of rows successfully created */
  created: number;
  /** Optional array of created row data */
  data?: Row[];
}

/**
 * Response from bulk update operations.
 * 
 * Indicates how many rows were successfully updated and optionally
 * includes the updated row data.
 */
export interface BulkUpdateResponse {
  /** Number of rows successfully updated */
  updated: number;
  /** Optional array of updated row data */
  data?: Row[];
}

/**
 * Response from bulk delete operations.
 * 
 * Indicates how many rows were successfully deleted.
 */
export interface BulkDeleteResponse {
  /** Number of rows successfully deleted */
  deleted: number;
}

/**
 * Details about a failed item in a bulk operation.
 * 
 * Provides information about which item failed and why.
 */
export interface BulkOperationError {
  /** Index of the failed item in the input array */
  index: number;
  /** The item that failed */
  item: Row;
  /** Error message describing the failure */
  error: string;
  /** Error code if available */
  code?: string;
}

/**
 * Enhanced response from bulk create operations with error tracking.
 * 
 * Includes success/failure counts and details about failed items.
 */
export interface BulkCreateResponseWithErrors extends BulkCreateResponse {
  /** Number of rows that failed to create */
  failed?: number;
  /** Details about failed items */
  errors?: BulkOperationError[];
}

/**
 * Enhanced response from bulk update operations with error tracking.
 * 
 * Includes success/failure counts and details about failed items.
 */
export interface BulkUpdateResponseWithErrors extends BulkUpdateResponse {
  /** Number of rows that failed to update */
  failed?: number;
  /** Details about failed items */
  errors?: BulkOperationError[];
}

/**
 * Enhanced response from bulk delete operations with error tracking.
 * 
 * Includes success/failure counts and details about failed items.
 */
export interface BulkDeleteResponseWithErrors extends BulkDeleteResponse {
  /** Number of rows that failed to delete */
  failed?: number;
  /** Details about failed items */
  errors?: BulkOperationError[];
}

/**
 * Error response structure from NocoDB API.
 * 
 * The API may return error messages in different fields depending
 * on the endpoint and error type.
 */
export interface ErrorResponse {
  /** Error message (some endpoints use 'msg') */
  msg?: string;
  /** Error message (some endpoints use 'message') */
  message?: string;
  /** Error message (some endpoints use 'error') */
  error?: string;
}
