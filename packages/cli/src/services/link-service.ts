/**
 * Link service for managing linked record operations.
 * 
 * This service provides business logic for link operations between records
 * in related tables. It handles:
 * 
 * - Listing linked records for a specific record and link field
 * - Linking records together via a link field
 * - Unlinking records from a link field
 * 
 * @module services/link-service
 */

import type { NocoClient, Row, ListResponse } from "@nocodb/sdk";

/**
 * Service for managing linked record operations.
 * 
 * The LinkService provides business logic for all link-related operations,
 * delegating to the SDK DataApi methods for actual API calls.
 * 
 * @example
 * ```typescript
 * // Create a link service
 * const linkService = new LinkService(client);
 * 
 * // List linked records
 * const links = await linkService.list('tbl123', 'col456', 'rec789');
 * console.log(`Found ${links.pageInfo.totalRows} linked records`);
 * 
 * // Link records
 * await linkService.link('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
 * 
 * // Unlink records
 * await linkService.unlink('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
 * ```
 */
export class LinkService {
  /**
   * Creates a new LinkService instance.
   * 
   * @param client - NocoClient instance for making API requests
   */
  constructor(private client: NocoClient) {}

  /**
   * Lists linked records for a specific record and link field.
   * 
   * This method retrieves all records that are linked to the specified record
   * through the given link field (column). Supports pagination and filtering
   * through query parameters.
   * 
   * @param tableId - The table ID containing the record
   * @param linkFieldId - The link field (column) ID
   * @param recordId - The record ID to get links for
   * @param query - Optional query parameters for filtering/pagination (limit, offset, where, sort, etc.)
   * @returns Promise resolving to paginated list of linked rows
   * 
   * @example
   * ```typescript
   * // List all linked records
   * const result = await linkService.list('tbl123', 'col456', 'rec789');
   * 
   * // List with pagination
   * const page2 = await linkService.list('tbl123', 'col456', 'rec789', {
   *   limit: '25',
   *   offset: '25'
   * });
   * 
   * // List with filters
   * const filtered = await linkService.list('tbl123', 'col456', 'rec789', {
   *   where: '(Status,eq,Active)'
   * });
   * ```
   */
  async list(
    tableId: string,
    linkFieldId: string,
    recordId: string,
    query?: Record<string, string>
  ): Promise<ListResponse<Row>> {
    return this.client.request<ListResponse<Row>>(
      "GET",
      `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`,
      { query }
    );
  }

  /**
   * Links records together via a link field.
   * 
   * This method creates relationships between the specified record and one or more
   * target records through the given link field (column). The body should contain
   * an array of record identifiers to link.
   * 
   * @param tableId - The table ID containing the record
   * @param linkFieldId - The link field (column) ID
   * @param recordId - The record ID to link from
   * @param body - Array of record IDs or objects to link (e.g., [{ Id: 'rec999' }])
   * @returns Promise resolving to the operation result
   * 
   * @example
   * ```typescript
   * // Link a single record
   * await linkService.link('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
   * 
   * // Link multiple records
   * await linkService.link('tbl123', 'col456', 'rec789', [
   *   { Id: 'rec999' },
   *   { Id: 'rec888' }
   * ]);
   * ```
   */
  async link(
    tableId: string,
    linkFieldId: string,
    recordId: string,
    body: unknown
  ): Promise<unknown> {
    return this.client.request(
      "POST",
      `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`,
      { body }
    );
  }

  /**
   * Unlinks records from a link field.
   * 
   * This method removes relationships between the specified record and one or more
   * target records through the given link field (column). The body should contain
   * an array of record identifiers to unlink.
   * 
   * @param tableId - The table ID containing the record
   * @param linkFieldId - The link field (column) ID
   * @param recordId - The record ID to unlink from
   * @param body - Array of record IDs or objects to unlink (e.g., [{ Id: 'rec999' }])
   * @returns Promise resolving to the operation result
   * 
   * @example
   * ```typescript
   * // Unlink a single record
   * await linkService.unlink('tbl123', 'col456', 'rec789', [{ Id: 'rec999' }]);
   * 
   * // Unlink multiple records
   * await linkService.unlink('tbl123', 'col456', 'rec789', [
   *   { Id: 'rec999' },
   *   { Id: 'rec888' }
   * ]);
   * ```
   */
  async unlink(
    tableId: string,
    linkFieldId: string,
    recordId: string,
    body: unknown
  ): Promise<unknown> {
    return this.client.request(
      "DELETE",
      `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`,
      { body }
    );
  }
}
