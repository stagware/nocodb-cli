/**
 * Configuration types for the unified configuration system.
 * 
 * This module defines the TypeScript interfaces for workspace-scoped configuration,
 * global settings, and the unified configuration structure that consolidates
 * the legacy config.ts, settings.ts, and aliases.ts systems.
 * 
 * @module config/types
 */

/**
 * Configuration for a single workspace (NocoDB instance).
 * 
 * A workspace represents a connection to a specific NocoDB instance with its own
 * base URL, authentication headers, default base ID, and entity aliases.
 * 
 * @example
 * ```typescript
 * const workspace: WorkspaceConfig = {
 *   baseUrl: 'https://app.nocodb.com',
 *   headers: {
 *     'xc-token': 'your-api-token-here'
 *   },
 *   baseId: 'p1234567890abcdef',
 *   aliases: {
 *     'mybase': 'p1234567890abcdef',
 *     'users': 't9876543210fedcba',
 *     'grid': 'v1122334455667788'
 *   }
 * };
 * ```
 */
export interface WorkspaceConfig {
  /**
   * Base URL of the NocoDB instance (e.g., 'https://app.nocodb.com').
   * Must be a valid HTTP or HTTPS URL.
   */
  baseUrl: string;

  /**
   * HTTP headers to include in all requests to this workspace.
   * Typically includes authentication tokens (e.g., 'xc-token').
   */
  headers: Record<string, string>;

  /**
   * Default base ID for this workspace.
   * Used when commands don't specify a base ID explicitly.
   */
  baseId?: string;

  /**
   * Entity aliases for this workspace.
   * Maps friendly names to UUIDs for bases, tables, views, columns, etc.
   * 
   * @example
   * ```typescript
   * {
   *   'mybase': 'p1234567890abcdef',  // base alias
   *   'users': 't9876543210fedcba',   // table alias
   *   'grid': 'v1122334455667788'     // view alias
   * }
   * ```
   */
  aliases: Record<string, string>;
}

/**
 * Global settings that apply across all workspaces.
 * 
 * These settings control HTTP client behavior including timeouts and retry logic.
 * They can be overridden by CLI flags on a per-command basis.
 * 
 * @example
 * ```typescript
 * const settings: GlobalSettings = {
 *   timeoutMs: 30000,
 *   retryCount: 3,
 *   retryDelay: 1000,
 *   retryStatusCodes: [408, 429, 500, 502, 503, 504]
 * };
 * ```
 */
export interface GlobalSettings {
  /**
   * Request timeout in milliseconds.
   * Requests that exceed this duration will be aborted.
   * 
   * @default 30000 (30 seconds)
   */
  timeoutMs: number;

  /**
   * Number of retry attempts for failed requests.
   * Set to 0 to disable retries.
   * 
   * @default 3
   */
  retryCount: number;

  /**
   * Delay in milliseconds between retry attempts.
   * 
   * @default 1000 (1 second)
   */
  retryDelay: number;

  /**
   * HTTP status codes that should trigger a retry.
   * Typically includes temporary server errors and rate limiting.
   * 
   * @default [408, 429, 500, 502, 503, 504]
   */
  retryStatusCodes: number[];
}

/**
 * Unified configuration structure that consolidates all CLI configuration.
 * 
 * This structure replaces the legacy config.json, settings.json, and aliases
 * systems with a single, coherent configuration format. It supports multiple
 * workspaces with workspace-scoped aliases and global settings.
 * 
 * Configuration precedence (highest to lowest):
 * 1. CLI flags (per-command)
 * 2. Workspace config (per-workspace)
 * 3. Global settings (shared across workspaces)
 * 4. Default values (hardcoded)
 * 
 * @example
 * ```typescript
 * const config: UnifiedConfig = {
 *   version: 2,
 *   activeWorkspace: 'production',
 *   workspaces: {
 *     'production': {
 *       baseUrl: 'https://app.nocodb.com',
 *       headers: { 'xc-token': 'prod-token' },
 *       baseId: 'p1234567890abcdef',
 *       aliases: { 'users': 't9876543210fedcba' }
 *     },
 *     'staging': {
 *       baseUrl: 'https://staging.nocodb.com',
 *       headers: { 'xc-token': 'staging-token' },
 *       baseId: 'p0987654321fedcba',
 *       aliases: { 'users': 't1234567890abcdef' }
 *     }
 *   },
 *   settings: {
 *     timeoutMs: 30000,
 *     retryCount: 3,
 *     retryDelay: 1000,
 *     retryStatusCodes: [408, 429, 500, 502, 503, 504]
 *   }
 * };
 * ```
 */
export interface UnifiedConfig {
  /**
   * Configuration format version.
   * Used to support future migrations and format changes.
   * 
   * @default 2
   */
  version: 2;

  /**
   * Name of the currently active workspace.
   * Commands will use this workspace's configuration by default.
   */
  activeWorkspace?: string;

  /**
   * Map of workspace names to their configurations.
   * Each workspace represents a separate NocoDB instance.
   */
  workspaces: Record<string, WorkspaceConfig>;

  /**
   * Global settings that apply to all workspaces.
   * Can be overridden by CLI flags on a per-command basis.
   */
  settings: GlobalSettings;
}
