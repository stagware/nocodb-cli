/**
 * Row service for managing table row operations.
 * 
 * This service provides business logic for row CRUD operations, bulk operations,
 * and upsert functionality. It handles:
 * 
 * - Single row operations (list, create, update, delete)
 * - Bulk operations (bulkCreate, bulkUpdate, bulkDelete)
 * - Upsert operations with match field logic
 * - Bulk upsert with pagination for large datasets
 * - Swagger validation for create/update operations
 * 
 * @module services/row-service
 */

import type { 
  NocoClient, 
  Row, 
  ListResponse, 
  BulkCreateResponse, 
  BulkUpdateResponse, 
  BulkDeleteResponse,
  BulkOperationError,
  BulkCreateResponseWithErrors,
  BulkUpdateResponseWithErrors,
  BulkDeleteResponseWithErrors
} from "@nocodb/sdk";
import { ValidationError, NotFoundError, ConflictError, NocoDBError } from "@nocodb/sdk";
import type { SwaggerService } from "./swagger-service.js";
import { findOperation, validateRequestBody } from "../utils/swagger.js";

/**
 * Options for upsert operations
 */
export interface UpsertOptions {
  /** Only create, fail if a matching row exists */
  createOnly?: boolean;
  /** Only update, fail if no matching row exists */
  updateOnly?: boolean;
  /** Additional query parameters for list operations */
  query?: Record<string, string>;
}

/**
 * Options for bulk operations with error handling
 */
export interface BulkOperationOptions {
  /** Stop processing on first error (default: false) */
  failFast?: boolean;
  /** Continue processing remaining items on error (default: true) */
  continueOnError?: boolean;
  /** Batch size for processing bulk operations (default: 1000) */
  batchSize?: number;
}

/**
 * Result of a bulk upsert operation
 */
export interface BulkUpsertResponse {
  /** Result of created rows */
  created?: BulkCreateResponse;
  /** Result of updated rows */
  updated?: BulkUpdateResponse;
}

/**
 * Service for managing table row operations.
 * 
 * The RowService provides business logic for all row-related operations,
 * including CRUD, bulk operations, and upsert functionality. It integrates
 * with SwaggerService for request validation.
 * 
 * @example
 * ```typescript
 * // Create a row service
 * const rowService = new RowService(client, swaggerService);
 * 
 * // List rows
 * const rows = await rowService.list('tbl123', { limit: '10' });
 * 
 * // Create a row with validation
 * const newRow = await rowService.create('tbl123', { title: 'New Row' }, 'base123');
 * 
 * // Upsert a row
 * const row = await rowService.upsert(
 *   'tbl123',
 *   { title: 'Updated' },
 *   'email',
 *   'user@example.com',
 *   'base123'
 * );
 * ```
 */
export class RowService {
  /**
   * Creates a new RowService instance.
   * 
   * @param client - NocoClient instance for making API requests
   * @param swaggerService - SwaggerService for fetching and caching swagger docs
   */
  constructor(
    private client: NocoClient,
    private swaggerService: SwaggerService
  ) {}

  /**
   * Lists rows from a table with optional query parameters.
   * 
   * @param tableId - The table ID to list rows from
   * @param query - Optional query parameters (limit, offset, where, sort, etc.)
   * @returns Promise resolving to paginated list of rows
   * 
   * @example
   * ```typescript
   * // List all rows
   * const result = await rowService.list('tbl123');
   * 
   * // List with pagination
   * const page2 = await rowService.list('tbl123', { limit: '25', offset: '25' });
   * 
   * // List with filters
   * const filtered = await rowService.list('tbl123', { where: '(Status,eq,Active)' });
   * ```
   */
  async list(tableId: string, query?: Record<string, string>): Promise<ListResponse<Row>> {
    return this.client.request<ListResponse<Row>>(
      "GET",
      `/api/v2/tables/${tableId}/records`,
      { query }
    );
  }

  /**
   * Creates a single row in a table with swagger validation.
   * 
   * @param tableId - The table ID to create the row in
   * @param data - Row data to create
   * @param baseId - Base ID for swagger validation
   * @returns Promise resolving to the created row
   * @throws {ValidationError} If the data doesn't match the swagger schema
   * 
   * @example
   * ```typescript
   * const newRow = await rowService.create('tbl123', {
   *   title: 'New Task',
   *   status: 'Active'
   * }, 'base123');
   * ```
   */
  async create(tableId: string, data: Row, baseId: string): Promise<Row> {
    // Validate against swagger schema
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "post", `/api/v2/tables/${tableId}/records`);
    if (op) {
      validateRequestBody(op, swagger, data);
    }

    return this.client.request<Row>(
      "POST",
      `/api/v2/tables/${tableId}/records`,
      { body: data }
    );
  }

  /**
   * Updates a single row or multiple rows in a table with swagger validation.
   * 
   * @param tableId - The table ID to update rows in
   * @param data - Row data to update (must include Id field)
   * @param baseId - Base ID for swagger validation
   * @returns Promise resolving to the updated row(s)
   * @throws {ValidationError} If the data doesn't match the swagger schema
   * 
   * @example
   * ```typescript
   * // Update single row
   * const updated = await rowService.update('tbl123', {
   *   Id: 'rec123',
   *   status: 'Completed'
   * }, 'base123');
   * ```
   */
  async update(tableId: string, data: Row, baseId: string): Promise<Row> {
    // Validate against swagger schema
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);
    if (op) {
      validateRequestBody(op, swagger, data);
    }

    return this.client.request<Row>(
      "PATCH",
      `/api/v2/tables/${tableId}/records`,
      { body: data }
    );
  }

  /**
   * Deletes a single row or multiple rows from a table.
   * 
   * @param tableId - The table ID to delete rows from
   * @param data - Row identifier(s) to delete (must include Id field)
   * @param baseId - Base ID for swagger validation
   * @returns Promise resolving to the deletion result
   * 
   * @example
   * ```typescript
   * // Delete single row
   * await rowService.delete('tbl123', { Id: 'rec123' }, 'base123');
   * ```
   */
  async delete(tableId: string, data: Row, baseId: string): Promise<unknown> {
    // Validate against swagger schema
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "delete", `/api/v2/tables/${tableId}/records`);
    if (op) {
      validateRequestBody(op, swagger, data);
    }

    return this.client.request(
      "DELETE",
      `/api/v2/tables/${tableId}/records`,
      { body: data }
    );
  }

  /**
   * Creates multiple rows in a table with swagger validation and error handling.
   * 
   * Supports two modes:
   * - **Fail-fast mode** (failFast: true): Stops on first error and throws
   * - **Continue-on-error mode** (default): Processes all items, tracks failures
   * 
   * @param tableId - The table ID to create rows in
   * @param rows - Array of row data to create
   * @param baseId - Base ID for swagger validation
   * @param options - Bulk operation options (failFast, continueOnError)
   * @returns Promise resolving to bulk create response with success/failure counts
   * @throws {ValidationError} If any row doesn't match the swagger schema (fail-fast mode)
   * 
   * @example
   * ```typescript
   * // Default: continue on error
   * const result = await rowService.bulkCreate('tbl123', [
   *   { title: 'Task 1', status: 'Active' },
   *   { title: 'Task 2', status: 'Pending' }
   * ], 'base123');
   * console.log(`Created ${result.created} rows, Failed ${result.failed || 0} rows`);
   * 
   * // Fail-fast mode
   * const result = await rowService.bulkCreate('tbl123', rows, 'base123', { failFast: true });
   * ```
   */
  async bulkCreate(
    tableId: string, 
    rows: Row[], 
    baseId: string,
    options: BulkOperationOptions = {}
  ): Promise<BulkCreateResponseWithErrors> {
    // Validate array input
    if (!Array.isArray(rows)) {
      throw new ValidationError("bulkCreate expects an array of row objects");
    }

    // Default to continue-on-error unless failFast is explicitly true
    const continueOnError = options.failFast ? false : (options.continueOnError ?? true);
    const batchSize = options.batchSize ?? 1000;

    // Get swagger for validation
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "post", `/api/v2/tables/${tableId}/records`);

    // If fail-fast mode, process in batches but stop on first error
    if (!continueOnError) {
      let totalCreated = 0;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        if (op) {
          validateRequestBody(op, swagger, batch);
        }

        const result = await this.client.request<BulkCreateResponse>(
          "POST",
          `/api/v2/tables/${tableId}/records`,
          { body: batch }
        );
        
        // Accumulate the count from the API response
        totalCreated += result.created ?? (result.data?.length || 0);
      }

      // Return response matching API format (just the count, no data array)
      return { created: totalCreated } as BulkCreateResponseWithErrors;
    }

    // Continue-on-error mode: process items individually
    const successfulRows: Row[] = [];
    const errors: BulkOperationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate individual row
        if (op) {
          validateRequestBody(op, swagger, row);
        }

        // Create single row
        const created = await this.client.request<Row>(
          "POST",
          `/api/v2/tables/${tableId}/records`,
          { body: row }
        );
        
        successfulRows.push(created);
      } catch (err) {
        // Track error details
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorCode = err instanceof NocoDBError ? err.code : undefined;
        
        errors.push({
          index: i,
          item: row,
          error: errorMessage,
          code: errorCode,
        });
      }
    }

    return {
      created: successfulRows.length,
      data: successfulRows,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Updates multiple rows in a table with swagger validation and error handling.
   * 
   * Supports two modes:
   * - **Fail-fast mode** (failFast: true): Stops on first error and throws
   * - **Continue-on-error mode** (default): Processes all items, tracks failures
   * 
   * @param tableId - The table ID to update rows in
   * @param rows - Array of row data to update (each must include Id field)
   * @param baseId - Base ID for swagger validation
   * @param options - Bulk operation options (failFast, continueOnError)
   * @returns Promise resolving to bulk update response with success/failure counts
   * @throws {ValidationError} If any row doesn't match the swagger schema (fail-fast mode)
   * 
   * @example
   * ```typescript
   * // Default: continue on error
   * const result = await rowService.bulkUpdate('tbl123', [
   *   { Id: 'rec1', status: 'Completed' },
   *   { Id: 'rec2', status: 'Completed' }
   * ], 'base123');
   * console.log(`Updated ${result.updated} rows, Failed ${result.failed || 0} rows`);
   * 
   * // Fail-fast mode
   * const result = await rowService.bulkUpdate('tbl123', rows, 'base123', { failFast: true });
   * ```
   */
  async bulkUpdate(
    tableId: string, 
    rows: Row[], 
    baseId: string,
    options: BulkOperationOptions = {}
  ): Promise<BulkUpdateResponseWithErrors> {
    // Validate array input
    if (!Array.isArray(rows)) {
      throw new ValidationError("bulkUpdate expects an array of row objects");
    }

    // Default to continue-on-error unless failFast is explicitly true
    const continueOnError = options.failFast ? false : (options.continueOnError ?? true);
    const batchSize = options.batchSize ?? 1000;

    // Get swagger for validation
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);

    // If fail-fast mode, process in batches but stop on first error
    if (!continueOnError) {
      let totalUpdated = 0;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        if (op) {
          validateRequestBody(op, swagger, batch);
        }

        const result = await this.client.request<BulkUpdateResponse>(
          "PATCH",
          `/api/v2/tables/${tableId}/records`,
          { body: batch }
        );
        
        // Accumulate the count from the API response
        totalUpdated += result.updated ?? (result.data?.length || 0);
      }

      // Return response matching API format (just the count, no data array)
      return { updated: totalUpdated } as BulkUpdateResponseWithErrors;
    }

    // Continue-on-error mode: process items individually
    const successfulRows: Row[] = [];
    const errors: BulkOperationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate individual row
        if (op) {
          validateRequestBody(op, swagger, row);
        }

        // Update single row
        const updated = await this.client.request<Row>(
          "PATCH",
          `/api/v2/tables/${tableId}/records`,
          { body: row }
        );
        
        successfulRows.push(updated);
      } catch (err) {
        // Track error details
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorCode = err instanceof NocoDBError ? err.code : undefined;
        
        errors.push({
          index: i,
          item: row,
          error: errorMessage,
          code: errorCode,
        });
      }
    }

    return {
      updated: successfulRows.length,
      data: successfulRows,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Deletes multiple rows from a table with error handling.
   * 
   * Supports two modes:
   * - **Fail-fast mode** (failFast: true): Stops on first error and throws
   * - **Continue-on-error mode** (default): Processes all items, tracks failures
   * 
   * @param tableId - The table ID to delete rows from
   * @param rows - Array of row identifiers to delete (each must include Id field)
   * @param baseId - Base ID for swagger validation
   * @param options - Bulk operation options (failFast, continueOnError)
   * @returns Promise resolving to bulk delete response with success/failure counts
   * @throws {ValidationError} If the input is not a valid array (fail-fast mode)
   * 
   * @example
   * ```typescript
   * // Default: continue on error
   * const result = await rowService.bulkDelete('tbl123', [
   *   { Id: 'rec1' },
   *   { Id: 'rec2' }
   * ], 'base123');
   * console.log(`Deleted ${result.deleted} rows, Failed ${result.failed || 0} rows`);
   * 
   * // Fail-fast mode
   * const result = await rowService.bulkDelete('tbl123', rows, 'base123', { failFast: true });
   * ```
   */
  async bulkDelete(
    tableId: string, 
    rows: Row[], 
    baseId: string,
    options: BulkOperationOptions = {}
  ): Promise<BulkDeleteResponseWithErrors> {
    // Validate array input
    if (!Array.isArray(rows)) {
      throw new ValidationError("bulkDelete expects an array of row identifiers");
    }

    // Default to continue-on-error unless failFast is explicitly true
    const continueOnError = options.failFast ? false : (options.continueOnError ?? true);
    const batchSize = options.batchSize ?? 1000;

    // Get swagger for validation
    const swagger = await this.swaggerService.getSwagger(baseId);
    const op = findOperation(swagger, "delete", `/api/v2/tables/${tableId}/records`);

    // If fail-fast mode, process in batches but stop on first error
    if (!continueOnError) {
      let deletedCount = 0;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        if (op) {
          validateRequestBody(op, swagger, batch);
        }

        const result = await this.client.request<BulkDeleteResponse>(
          "DELETE",
          `/api/v2/tables/${tableId}/records`,
          { body: batch }
        );
        
        deletedCount += result.deleted ?? batch.length;
      }

      return {
        deleted: deletedCount,
      };
    }

    // Continue-on-error mode: process items individually
    let deletedCount = 0;
    const errors: BulkOperationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate individual row
        if (op) {
          validateRequestBody(op, swagger, row);
        }

        // Delete single row
        await this.client.request(
          "DELETE",
          `/api/v2/tables/${tableId}/records`,
          { body: row }
        );
        
        deletedCount++;
      } catch (err) {
        // Track error details
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorCode = err instanceof NocoDBError ? err.code : undefined;
        
        errors.push({
          index: i,
          item: row,
          error: errorMessage,
          code: errorCode,
        });
      }
    }

    return {
      deleted: deletedCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Upserts a single row (create if not exists, update if exists) based on a match field.
   * 
   * This method searches for an existing row by matching a field value. If found,
   * it updates the row. If not found, it creates a new row. The match must be unique.
   * 
   * @param tableId - The table ID to upsert the row in
   * @param data - Row data to upsert
   * @param matchField - Field name to match on
   * @param matchValue - Field value to match
   * @param baseId - Base ID for swagger validation
   * @param options - Upsert options (createOnly, updateOnly, query)
   * @returns Promise resolving to the created or updated row
   * @throws {ValidationError} If multiple rows match or if data is invalid
   * @throws {NotFoundError} If updateOnly is true and no row matches
   * @throws {ConflictError} If createOnly is true and a row already exists
   * 
   * @example
   * ```typescript
   * // Upsert by email
   * const row = await rowService.upsert(
   *   'tbl123',
   *   { email: 'user@example.com', name: 'John' },
   *   'email',
   *   'user@example.com',
   *   'base123'
   * );
   * 
   * // Create only (fail if exists)
   * const newRow = await rowService.upsert(
   *   'tbl123',
   *   { email: 'new@example.com', name: 'Jane' },
   *   'email',
   *   'new@example.com',
   *   'base123',
   *   { createOnly: true }
   * );
   * ```
   */
  async upsert(
    tableId: string,
    data: Row,
    matchField: string,
    matchValue: string,
    baseId: string,
    options: UpsertOptions = {}
  ): Promise<Row> {
    // Validate options
    if (options.createOnly && options.updateOnly) {
      throw new ValidationError("Cannot specify both createOnly and updateOnly");
    }

    // Validate data is an object
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ValidationError("upsert expects a row object");
    }

    // Get swagger for validation
    const swagger = await this.swaggerService.getSwagger(baseId);

    // Find existing rows matching the field value
    const existing = await this.findByField(tableId, matchField, matchValue, options.query);

    // Check for multiple matches (ambiguous)
    if (existing.length > 1) {
      throw new ValidationError(
        `Multiple rows matched '${matchField}=${matchValue}'. Upsert requires unique match.`
      );
    }

    // No match found - create new row
    if (existing.length === 0) {
      if (options.updateOnly) {
        throw new NotFoundError("Row", `${matchField}=${matchValue}`);
      }

      // Validate and create
      const createOp = findOperation(swagger, "post", `/api/v2/tables/${tableId}/records`);
      if (createOp) {
        validateRequestBody(createOp, swagger, data);
      }

      try {
        return await this.client.request<Row>(
          "POST",
          `/api/v2/tables/${tableId}/records`,
          { body: data }
        );
      } catch (err) {
        // Handle race condition: row was created between our check and create attempt
        if (!options.createOnly && this.isConflictError(err)) {
          // Retry: fetch again and update if we find exactly one match
          const retryExisting = await this.findByField(tableId, matchField, matchValue, options.query);
          if (retryExisting.length === 1) {
            const recordId = this.getRecordId(retryExisting[0]);
            const updateBody = this.withRecordId(data, recordId);
            
            const updateOp = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);
            if (updateOp) {
              validateRequestBody(updateOp, swagger, updateBody);
            }

            return this.client.request<Row>(
              "PATCH",
              `/api/v2/tables/${tableId}/records`,
              { body: updateBody }
            );
          }
        }
        throw err;
      }
    }

    // Match found - update existing row
    if (options.createOnly) {
      throw new ConflictError(`Row already exists: ${matchField}=${matchValue}`);
    }

    const recordId = this.getRecordId(existing[0]);
    const updateBody = this.withRecordId(data, recordId);

    // Validate and update
    const updateOp = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);
    if (updateOp) {
      validateRequestBody(updateOp, swagger, updateBody);
    }

    return this.client.request<Row>(
      "PATCH",
      `/api/v2/tables/${tableId}/records`,
      { body: updateBody }
    );
  }

  /**
   * Upserts multiple rows based on a match field.
   * 
   * This method processes an array of rows, determining for each whether to create
   * or update based on matching an existing row by the specified field. It handles
   * pagination to fetch all existing rows for matching.
   * 
   * @param tableId - The table ID to upsert rows in
   * @param rows - Array of row data to upsert
   * @param matchField - Field name to match on
   * @param baseId - Base ID for swagger validation
   * @param options - Upsert options (createOnly, updateOnly, query)
   * @returns Promise resolving to bulk upsert response with created and updated results
   * @throws {ValidationError} If multiple rows match the same value or if data is invalid
   * @throws {NotFoundError} If updateOnly is true and a row doesn't match
   * @throws {ConflictError} If createOnly is true and a row already exists
   * 
   * @example
   * ```typescript
   * const result = await rowService.bulkUpsert(
   *   'tbl123',
   *   [
   *     { email: 'user1@example.com', name: 'User 1' },
   *     { email: 'user2@example.com', name: 'User 2' }
   *   ],
   *   'email',
   *   'base123'
   * );
   * console.log(`Created: ${result.created?.created}, Updated: ${result.updated?.updated}`);
   * ```
   */
  async bulkUpsert(
    tableId: string,
    rows: Row[],
    matchField: string,
    baseId: string,
    options: UpsertOptions = {}
  ): Promise<BulkUpsertResponse> {
    // Validate options
    if (options.createOnly && options.updateOnly) {
      throw new ValidationError("Cannot specify both createOnly and updateOnly");
    }

    // Validate input is an array
    if (!Array.isArray(rows)) {
      throw new ValidationError("bulkUpsert expects an array of row objects");
    }

    // Get swagger for validation
    const swagger = await this.swaggerService.getSwagger(baseId);
    const createOp = findOperation(swagger, "post", `/api/v2/tables/${tableId}/records`);
    const updateOp = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);

    // Validate all rows upfront
    if (createOp) {
      validateRequestBody(createOp, swagger, rows);
    }

    // Fetch all existing rows with pagination
    const existingRows = await this.fetchAllRows(tableId, options.query);

    // Separate rows into create and update buckets
    const toCreate: Row[] = [];
    const toUpdate: Row[] = [];

    for (const row of rows) {
      const matchValue = row[matchField];

      // If no match value, must be a create
      if (matchValue === undefined || matchValue === null) {
        if (options.updateOnly) {
          throw new ValidationError(`Row missing match field '${matchField}'`);
        }
        toCreate.push(row);
        continue;
      }

      // Find matching existing rows
      const matches = existingRows.filter((existing) =>
        this.matchesFieldValue(existing, matchField, String(matchValue))
      );

      // Check for multiple matches (ambiguous)
      if (matches.length > 1) {
        throw new ValidationError(
          `Multiple rows matched '${matchField}=${matchValue}'. Bulk upsert requires unique matches.`
        );
      }

      // Match found - update
      if (matches.length === 1) {
        if (options.createOnly) {
          throw new ConflictError(`Row already exists for '${matchField}=${matchValue}'`);
        }
        const recordId = this.getRecordId(matches[0]);
        toUpdate.push(this.withRecordId(row, recordId));
      } else {
        // No match - create
        if (options.updateOnly) {
          throw new NotFoundError("Row", `${matchField}=${matchValue}`);
        }
        toCreate.push(row);
      }
    }

    // Execute bulk operations
    const result: BulkUpsertResponse = {};

    if (toCreate.length > 0) {
      result.created = await this.client.request<BulkCreateResponse>(
        "POST",
        `/api/v2/tables/${tableId}/records`,
        { body: toCreate }
      );
    }

    if (toUpdate.length > 0) {
      // Validate update payload
      if (updateOp) {
        validateRequestBody(updateOp, swagger, toUpdate);
      }

      result.updated = await this.client.request<BulkUpdateResponse>(
        "PATCH",
        `/api/v2/tables/${tableId}/records`,
        { body: toUpdate }
      );
    }

    return result;
  }

  /**
   * Finds rows by matching a field value.
   * 
   * @param tableId - The table ID to search in
   * @param field - Field name to match on
   * @param value - Field value to match
   * @param query - Optional additional query parameters
   * @returns Promise resolving to array of matching rows
   * @private
   */
  private async findByField(
    tableId: string,
    field: string,
    value: string,
    query?: Record<string, string>
  ): Promise<Row[]> {
    const result = await this.list(tableId, query);
    return result.list.filter((row) => this.matchesFieldValue(row, field, value));
  }

  /**
   * Fetches all rows from a table using pagination.
   * 
   * @param tableId - The table ID to fetch rows from
   * @param query - Optional query parameters
   * @returns Promise resolving to array of all rows
   * @private
   */
  private async fetchAllRows(
    tableId: string,
    query?: Record<string, string>
  ): Promise<Row[]> {
    const pageSize = 1000;

    // First request — also tells us totalRows so we can short-circuit
    const first = await this.list(tableId, {
      ...query,
      page: "1",
      limit: String(pageSize),
    });

    const totalRows = first.pageInfo?.totalRows ?? 0;

    // Short-circuit: everything fits in the first page
    if (first.list.length === 0 || first.list.length >= totalRows || first.list.length < pageSize) {
      return first.list;
    }

    // Need more pages
    const allRows: Row[] = [...first.list];
    let page = 2;

    while (allRows.length < totalRows) {
      const result = await this.list(tableId, {
        ...query,
        page: String(page),
        limit: String(pageSize),
      });

      if (result.list.length === 0) break; // safety: server returned nothing
      allRows.push(...result.list);
      page += 1;
    }

    return allRows;
  }

  /**
   * Checks if a row's field value matches the expected value.
   * 
   * @param row - Row to check
   * @param field - Field name to check
   * @param expected - Expected value (as string)
   * @returns True if the field value matches
   * @private
   */
  private matchesFieldValue(row: Row, field: string, expected: string): boolean {
    if (!(field in row)) {
      return false;
    }
    const value = row[field];
    if (value === null || value === undefined) {
      return false;
    }
    return String(value) === expected;
  }

  /**
   * Gets the record ID from a row.
   * 
   * @param row - Row to extract ID from
   * @returns Record ID
   * @throws {ValidationError} If the row doesn't have a valid Id field
   * @private
   */
  private getRecordId(row: Row): string | number {
    const id = row.Id ?? row.id;
    if (typeof id === "string" || typeof id === "number") {
      return id;
    }
    throw new ValidationError("Row does not contain a valid Id field");
  }

  /**
   * Adds or validates the record ID in a row object.
   * 
   * @param body - Row data
   * @param id - Record ID to add
   * @returns Row data with Id field
   * @throws {ValidationError} If the body already has a different Id
   * @private
   */
  private withRecordId(body: Row, id: string | number): Row {
    const incomingId = body.Id ?? body.id;
    if (incomingId !== undefined && incomingId !== null && String(incomingId) !== String(id)) {
      throw new ValidationError(
        `Body Id '${String(incomingId)}' does not match record Id '${String(id)}'`
      );
    }
    return { ...body, Id: id };
  }

  /**
   * Checks if an error is a conflict error (409 status code).
   * 
   * @param err - Error to check
   * @returns True if the error is a conflict error
   * @private
   */
  private isConflictError(err: unknown): boolean {
    if (err instanceof ConflictError) {
      return true;
    }
    // Fallback check for legacy error format
    return (
      err instanceof Error &&
      typeof (err as any).statusCode === "number" &&
      (err as any).statusCode === 409
    );
  }
}
