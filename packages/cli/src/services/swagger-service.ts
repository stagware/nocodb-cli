/**
 * Swagger service for fetching and caching API documentation.
 * 
 * This service provides centralized swagger document management with caching
 * to improve performance and reduce redundant API calls. It handles:
 * 
 * - Fetching swagger documentation from NocoDB instances
 * - Caching swagger documents to disk for reuse
 * - Cache invalidation via --no-cache flag
 * - Automatic cache directory management
 * 
 * @module services/swagger-service
 */

import fs from "node:fs";
import path from "node:path";
import { MetaApi, NocoClient } from "@stagware/nocodb-sdk";
import type { SwaggerDoc } from "../utils/swagger.js";
import { isSwaggerDoc } from "../utils/swagger.js";
import type { ConfigManager } from "../config/manager.js";

/**
 * Service for managing swagger document fetching and caching.
 * 
 * The SwaggerService provides efficient access to NocoDB swagger documentation
 * by caching documents to disk and reusing them across CLI invocations. This
 * significantly improves performance for operations that need swagger metadata.
 * 
 * @example
 * ```typescript
 * // Create a swagger service
 * const swaggerService = new SwaggerService(
 *   (workspace, settings) => new NocoClient({ ... }),
 *   configManager
 * );
 * 
 * // Get swagger with caching (default)
 * const swagger = await swaggerService.getSwagger('p1234567890abcdef', true);
 * 
 * // Get swagger without cache (force refresh)
 * const freshSwagger = await swaggerService.getSwagger('p1234567890abcdef', false);
 * ```
 */
export class SwaggerService {
  private cacheDir: string;

  /** Cache TTL in milliseconds (default: 24 hours) */
  private cacheTtlMs: number;

  /** Maximum number of cached swagger files (default: 50) */
  private maxCacheEntries: number;

  /**
   * Creates a new SwaggerService instance.
   * 
   * @param createClient - Factory function to create NocoClient instances
   * @param configManager - Configuration manager for accessing config directory
   * @param options - Optional cache configuration
   */
  constructor(
    private createClient: (workspace?: any, settings?: any) => NocoClient,
    private configManager: ConfigManager,
    options?: { cacheTtlMs?: number; maxCacheEntries?: number }
  ) {
    // Cache directory is a subdirectory of the config directory
    this.cacheDir = path.join(configManager.getConfigDir(), "cache");
    this.cacheTtlMs = options?.cacheTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.maxCacheEntries = options?.maxCacheEntries ?? 50;
  }

  /**
   * Gets swagger documentation for a base, with optional caching.
   * 
   * This method fetches swagger documentation from the NocoDB API and caches
   * it to disk for future use. When useCache is true, it will attempt to load
   * from cache first before making an API request.
   * 
   * The cache file is stored as `swagger-{baseId}.json` in the cache directory.
   * 
   * @param baseId - The base ID to fetch swagger for
   * @param useCache - Whether to use cached swagger if available (default: true)
   * @returns Promise resolving to the swagger document
   * @throws {Error} If the API request fails or returns invalid swagger
   * 
   * @example
   * ```typescript
   * // Use cache if available
   * const swagger = await swaggerService.getSwagger('p1234567890abcdef');
   * 
   * // Force fresh fetch, bypassing cache
   * const freshSwagger = await swaggerService.getSwagger('p1234567890abcdef', false);
   * ```
   */
  async getSwagger(baseId: string, useCache = true): Promise<SwaggerDoc> {
    const cacheFile = this.getCacheFilePath(baseId);

    // Try to load from cache if enabled and not expired
    if (useCache) {
      try {
        const isExpired = await this.isCacheExpired(cacheFile);
        if (!isExpired) {
          const cached = await this.readCacheFile(cacheFile);
          if (isSwaggerDoc(cached)) {
            return cached;
          }
        }
      } catch {
        // Cache miss or invalid - fall through to fetch
      }
    }

    // Fetch from API
    const swagger = await this.fetchSwagger(baseId);

    // Save to cache for future use
    await this.writeCacheFile(cacheFile, swagger);

    // Evict old entries if cache is too large
    await this.evictOldCacheEntries();

    return swagger;
  }

  /**
   * Ensures swagger cache exists for a base.
   * 
   * This method checks if a cached swagger document exists for the given base.
   * If not, it fetches and caches it. This is useful for pre-warming the cache.
   * 
   * @param baseId - The base ID to ensure cache for
   * @returns Promise that resolves when cache is ensured
   * 
   * @example
   * ```typescript
   * // Pre-warm cache for a base
   * await swaggerService.ensureSwaggerCache('p1234567890abcdef');
   * ```
   */
  async ensureSwaggerCache(baseId: string): Promise<void> {
    const cacheFile = this.getCacheFilePath(baseId);
    if (!fs.existsSync(cacheFile)) {
      await this.getSwagger(baseId, true);
    }
  }

  /**
   * Invalidates (deletes) the cached swagger for a base.
   * 
   * This method removes the cached swagger document from disk, forcing
   * the next getSwagger call to fetch fresh data from the API.
   * 
   * @param baseId - The base ID to invalidate cache for
   * @returns true if cache was deleted, false if it didn't exist
   * 
   * @example
   * ```typescript
   * // Clear cache for a base
   * const wasDeleted = await swaggerService.invalidateCache('p1234567890abcdef');
   * if (wasDeleted) {
   *   console.log('Cache cleared');
   * }
   * ```
   */
  async invalidateCache(baseId: string): Promise<boolean> {
    const cacheFile = this.getCacheFilePath(baseId);
    try {
      if (fs.existsSync(cacheFile)) {
        await fs.promises.unlink(cacheFile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Invalidates all cached swagger documents by removing every swagger-*.json
   * file from the cache directory.
   *
   * @returns Number of cache files deleted
   */
  async invalidateAllCache(): Promise<number> {
    try {
      if (!fs.existsSync(this.cacheDir)) return 0;
      const files = await fs.promises.readdir(this.cacheDir);
      let deleted = 0;
      for (const file of files) {
        if (file.startsWith("swagger-") && file.endsWith(".json")) {
          await fs.promises.unlink(path.join(this.cacheDir, file));
          deleted++;
        }
      }
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Gets the cache file path for a base.
   * 
   * @param baseId - The base ID
   * @returns Full path to the cache file
   */
  private getCacheFilePath(baseId: string): string {
    return path.join(this.cacheDir, `swagger-${baseId}.json`);
  }

  /**
   * Fetches swagger documentation from the NocoDB API.
   * 
   * @param baseId - The base ID to fetch swagger for
   * @returns Promise resolving to the swagger document
   * @throws {Error} If the API request fails
   */
  private async fetchSwagger(baseId: string): Promise<SwaggerDoc> {
    // Get effective configuration
    const { workspace, settings } = this.configManager.getEffectiveConfig({});
    
    // Create client with current configuration
    const client = this.createClient(workspace, settings);
    
    // Create MetaApi instance
    const metaApi = new MetaApi(client);
    
    // Fetch swagger document
    const doc = await metaApi.getBaseSwagger(baseId);
    
    // Validate it's a swagger document
    if (!isSwaggerDoc(doc)) {
      throw new Error(`Invalid swagger document received for base ${baseId}`);
    }
    
    return doc as SwaggerDoc;
  }

  /**
   * Reads a swagger document from cache file.
   * 
   * @param filePath - Path to the cache file
   * @returns Promise resolving to the cached swagger document
   * @throws {Error} If file doesn't exist or contains invalid JSON
   */
  private async readCacheFile(filePath: string): Promise<unknown> {
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  /**
   * Writes a swagger document to cache file.
   * 
   * This method ensures the cache directory exists before writing.
   * 
   * @param filePath - Path to the cache file
   * @param data - Swagger document to cache
   * @returns Promise that resolves when write is complete
   */
  private async writeCacheFile(filePath: string, data: SwaggerDoc): Promise<void> {
    // Ensure cache directory exists
    await fs.promises.mkdir(this.cacheDir, { recursive: true });
    
    // Write swagger document with pretty formatting for readability
    const raw = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, raw, "utf8");
  }

  /**
   * Checks if a cache file has expired based on TTL.
   * 
   * @param filePath - Path to the cache file
   * @returns True if the file is expired or doesn't exist
   */
  private async isCacheExpired(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      const age = Date.now() - stat.mtimeMs;
      return age > this.cacheTtlMs;
    } catch {
      return true; // File doesn't exist or can't be read
    }
  }

  /**
   * Evicts oldest cache entries when the cache exceeds maxCacheEntries.
   * Entries are sorted by modification time and the oldest are removed.
   */
  private async evictOldCacheEntries(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) return;

      const files = await fs.promises.readdir(this.cacheDir);
      const swaggerFiles = files.filter((f) => f.startsWith("swagger-") && f.endsWith(".json"));

      if (swaggerFiles.length <= this.maxCacheEntries) return;

      // Get file stats and sort by modification time (oldest first)
      const fileStats = await Promise.all(
        swaggerFiles.map(async (file) => {
          const filePath = path.join(this.cacheDir, file);
          const stat = await fs.promises.stat(filePath);
          return { file, filePath, mtimeMs: stat.mtimeMs };
        })
      );

      fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);

      // Remove oldest entries to get back under the limit
      const toRemove = fileStats.slice(0, fileStats.length - this.maxCacheEntries);
      for (const entry of toRemove) {
        try {
          await fs.promises.unlink(entry.filePath);
        } catch {
          // Ignore individual deletion errors
        }
      }
    } catch {
      // Cache eviction is best-effort
    }
  }

  /**
   * Gets the cache directory path.
   * 
   * @returns Cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
}
