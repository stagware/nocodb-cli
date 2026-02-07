/**
 * Unit tests for SwaggerService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SwaggerService } from "../src/services/swagger-service.js";
import { ConfigManager } from "../src/config/manager.js";
import { NocoClient, MetaApi } from "@nocodb/sdk";

describe("SwaggerService", () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let swaggerService: SwaggerService;
  let mockClient: any;
  let mockMetaApi: any;

  beforeEach(() => {
    // Create temporary directory for test config
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "swagger-service-test-"));
    
    // Create config manager with temp directory
    configManager = new ConfigManager(tempDir);
    
    // Add a test workspace
    configManager.addWorkspace("test", {
      baseUrl: "https://test.nocodb.com",
      headers: { "xc-token": "test-token" },
      baseId: "p1234567890abcdef",
      aliases: {},
    });
    configManager.setActiveWorkspace("test");

    // Create mock client and MetaApi
    mockMetaApi = {
      getBaseSwagger: vi.fn(),
    };
    
    mockClient = {
      request: vi.fn(),
    };

    // Mock MetaApi constructor
    vi.spyOn(MetaApi.prototype, "getBaseSwagger").mockImplementation(
      mockMetaApi.getBaseSwagger
    );

    // Create factory function that returns mock client
    const createClient = vi.fn(() => mockClient as unknown as NocoClient);

    // Create swagger service
    swaggerService = new SwaggerService(createClient, configManager);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("getSwagger", () => {
    const mockSwagger = {
      paths: {
        "/api/v2/tables/{tableId}/records": {
          get: { operationId: "list-records" },
          post: { operationId: "create-record" },
        },
      },
    };

    it("should fetch swagger from API when cache is disabled", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      const result = await swaggerService.getSwagger("p1234567890abcdef", false);

      expect(result).toEqual(mockSwagger);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledWith("p1234567890abcdef");
    });

    it("should cache swagger document after fetching", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      await swaggerService.getSwagger("p1234567890abcdef", false);

      // Check cache file exists
      const cacheFile = path.join(
        swaggerService.getCacheDir(),
        "swagger-p1234567890abcdef.json"
      );
      expect(fs.existsSync(cacheFile)).toBe(true);

      // Verify cached content
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      expect(cached).toEqual(mockSwagger);
    });

    it("should use cached swagger when available and useCache is true", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // First call - fetch and cache
      await swaggerService.getSwagger("p1234567890abcdef", false);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await swaggerService.getSwagger("p1234567890abcdef", true);
      expect(result).toEqual(mockSwagger);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should bypass cache when useCache is false", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // First call - fetch and cache
      await swaggerService.getSwagger("p1234567890abcdef", false);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);

      // Second call with useCache=false - should fetch again
      const result = await swaggerService.getSwagger("p1234567890abcdef", false);
      expect(result).toEqual(mockSwagger);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(2); // Called again
    });

    it("should fetch from API if cached file is invalid", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // Write invalid cache file
      const cacheFile = path.join(
        swaggerService.getCacheDir(),
        "swagger-p1234567890abcdef.json"
      );
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, "invalid json", "utf8");

      // Should fall back to API fetch
      const result = await swaggerService.getSwagger("p1234567890abcdef", true);
      expect(result).toEqual(mockSwagger);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);
    });

    it("should fetch from API if cached file is not a swagger doc", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // Write non-swagger JSON to cache
      const cacheFile = path.join(
        swaggerService.getCacheDir(),
        "swagger-p1234567890abcdef.json"
      );
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify({ notSwagger: true }), "utf8");

      // Should fall back to API fetch
      const result = await swaggerService.getSwagger("p1234567890abcdef", true);
      expect(result).toEqual(mockSwagger);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);
    });

    it("should throw error if API returns invalid swagger", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue({ notSwagger: true });

      await expect(
        swaggerService.getSwagger("p1234567890abcdef", false)
      ).rejects.toThrow("Invalid swagger document received for base p1234567890abcdef");
    });

    it("should handle different base IDs independently", async () => {
      const swagger1 = { paths: { "/path1": {} } };
      const swagger2 = { paths: { "/path2": {} } };

      mockMetaApi.getBaseSwagger
        .mockResolvedValueOnce(swagger1)
        .mockResolvedValueOnce(swagger2);

      const result1 = await swaggerService.getSwagger("base1", false);
      const result2 = await swaggerService.getSwagger("base2", false);

      expect(result1).toEqual(swagger1);
      expect(result2).toEqual(swagger2);

      // Verify separate cache files
      const cache1 = path.join(swaggerService.getCacheDir(), "swagger-base1.json");
      const cache2 = path.join(swaggerService.getCacheDir(), "swagger-base2.json");
      expect(fs.existsSync(cache1)).toBe(true);
      expect(fs.existsSync(cache2)).toBe(true);
    });
  });

  describe("ensureSwaggerCache", () => {
    const mockSwagger = {
      paths: {
        "/api/v2/tables/{tableId}/records": {
          get: { operationId: "list-records" },
        },
      },
    };

    it("should fetch and cache swagger if cache does not exist", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      await swaggerService.ensureSwaggerCache("p1234567890abcdef");

      const cacheFile = path.join(
        swaggerService.getCacheDir(),
        "swagger-p1234567890abcdef.json"
      );
      expect(fs.existsSync(cacheFile)).toBe(true);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);
    });

    it("should not fetch if cache already exists", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // Create cache first
      await swaggerService.getSwagger("p1234567890abcdef", false);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);

      // Ensure cache - should not fetch again
      await swaggerService.ensureSwaggerCache("p1234567890abcdef");
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe("invalidateCache", () => {
    const mockSwagger = {
      paths: {
        "/api/v2/tables/{tableId}/records": {
          get: { operationId: "list-records" },
        },
      },
    };

    it("should delete cache file if it exists", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // Create cache
      await swaggerService.getSwagger("p1234567890abcdef", false);
      const cacheFile = path.join(
        swaggerService.getCacheDir(),
        "swagger-p1234567890abcdef.json"
      );
      expect(fs.existsSync(cacheFile)).toBe(true);

      // Invalidate cache
      const result = await swaggerService.invalidateCache("p1234567890abcdef");
      expect(result).toBe(true);
      expect(fs.existsSync(cacheFile)).toBe(false);
    });

    it("should return false if cache does not exist", async () => {
      const result = await swaggerService.invalidateCache("nonexistent");
      expect(result).toBe(false);
    });

    it("should force fresh fetch after invalidation", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue(mockSwagger);

      // Create cache
      await swaggerService.getSwagger("p1234567890abcdef", false);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(1);

      // Invalidate cache
      await swaggerService.invalidateCache("p1234567890abcdef");

      // Next fetch should call API again
      await swaggerService.getSwagger("p1234567890abcdef", true);
      expect(mockMetaApi.getBaseSwagger).toHaveBeenCalledTimes(2);
    });
  });

  describe("getCacheDir", () => {
    it("should return cache directory path", () => {
      const cacheDir = swaggerService.getCacheDir();
      expect(cacheDir).toBe(path.join(tempDir, "cache"));
    });
  });

  describe("cache directory creation", () => {
    it("should create cache directory if it does not exist", async () => {
      mockMetaApi.getBaseSwagger.mockResolvedValue({
        paths: { "/test": {} },
      });

      const cacheDir = swaggerService.getCacheDir();
      expect(fs.existsSync(cacheDir)).toBe(false);

      await swaggerService.getSwagger("p1234567890abcdef", false);

      expect(fs.existsSync(cacheDir)).toBe(true);
    });
  });
});
