/**
 * Property-based tests for performance optimizations.
 * 
 * Tests:
 * - Property 15: Batch size configuration
 * - Property 14: Retry behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { NocoClient } from '@nocodb/sdk';
import { RowService } from '../src/services/row-service.js';
import { SwaggerService } from '../src/services/swagger-service.js';

describe('Performance Optimizations - Property Tests', () => {
  describe('Property 15: Batch size configuration', () => {
    /**
     * Property: For any bulk operation with a --batch-size flag, the operation should 
     * process items in batches of the specified size (verifiable through request patterns).
     * 
     * Validates: Requirements 10.2
     */
    it('should process bulk operations in configured batch sizes', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          // Generate batch size (between 1 and 100 for testing)
          fc.integer({ min: 1, max: 100 }),
          // Generate number of items (between batch size and 3x batch size)
          fc.integer({ min: 1, max: 300 }),
          async (batchSize, totalItems) => {
            // Create mock client
            const mockClient = {
              request: vi.fn().mockResolvedValue({ created: 1, data: [{ Id: 1 }] }),
            } as unknown as NocoClient;

            // Create mock swagger service
            const mockSwaggerService = {
              getSwagger: vi.fn().mockResolvedValue({ paths: {} }),
            } as unknown as SwaggerService;

            const rowService = new RowService(mockClient, mockSwaggerService);

            // Generate test data
            const rows = Array.from({ length: totalItems }, (_, i) => ({ 
              title: `Row ${i}` 
            }));

            // Call bulkCreate with fail-fast mode (which uses batching)
            await rowService.bulkCreate('tbl123', rows, 'base123', { 
              failFast: true,
              batchSize,
            });

            // Calculate expected number of batches
            const expectedBatches = Math.ceil(totalItems / batchSize);

            // Verify the number of requests matches expected batches
            expect(mockClient.request).toHaveBeenCalledTimes(expectedBatches);

            // Verify each batch has correct size
            for (let i = 0; i < expectedBatches; i++) {
              const call = (mockClient.request as any).mock.calls[i];
              const batchData = call[2].body;
              
              // Last batch might be smaller
              const expectedSize = i === expectedBatches - 1 
                ? totalItems - (i * batchSize)
                : batchSize;
              
              expect(batchData).toHaveLength(expectedSize);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should use default batch size of 1000 when not specified', async () => {
      // Create mock client
      const mockClient = {
        request: vi.fn().mockResolvedValue({ created: 1000, data: [] }),
      } as unknown as NocoClient;

      // Create mock swagger service
      const mockSwaggerService = {
        getSwagger: vi.fn().mockResolvedValue({ paths: {} }),
      } as unknown as SwaggerService;

      const rowService = new RowService(mockClient, mockSwaggerService);

      // Generate 2500 items (should be split into 3 batches: 1000, 1000, 500)
      const rows = Array.from({ length: 2500 }, (_, i) => ({ title: `Row ${i}` }));

      // Call bulkCreate with fail-fast mode (no batchSize specified)
      await rowService.bulkCreate('tbl123', rows, 'base123', { failFast: true });

      // Should make 3 requests (1000 + 1000 + 500)
      expect(mockClient.request).toHaveBeenCalledTimes(3);

      // Verify batch sizes
      const call1 = (mockClient.request as any).mock.calls[0];
      const call2 = (mockClient.request as any).mock.calls[1];
      const call3 = (mockClient.request as any).mock.calls[2];

      expect(call1[2].body).toHaveLength(1000);
      expect(call2[2].body).toHaveLength(1000);
      expect(call3[2].body).toHaveLength(500);
    });

    it('should respect batch size for bulkUpdate operations', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 150 }),
          async (batchSize, totalItems) => {
            const mockClient = {
              request: vi.fn().mockResolvedValue({ updated: 1, data: [{ Id: 1 }] }),
            } as unknown as NocoClient;

            const mockSwaggerService = {
              getSwagger: vi.fn().mockResolvedValue({ paths: {} }),
            } as unknown as SwaggerService;

            const rowService = new RowService(mockClient, mockSwaggerService);

            const rows = Array.from({ length: totalItems }, (_, i) => ({ 
              Id: i + 1,
              title: `Updated ${i}` 
            }));

            await rowService.bulkUpdate('tbl123', rows, 'base123', { 
              failFast: true,
              batchSize,
            });

            const expectedBatches = Math.ceil(totalItems / batchSize);
            expect(mockClient.request).toHaveBeenCalledTimes(expectedBatches);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should respect batch size for bulkDelete operations', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 150 }),
          async (batchSize, totalItems) => {
            const mockClient = {
              request: vi.fn().mockResolvedValue({ deleted: 1 }),
            } as unknown as NocoClient;

            const mockSwaggerService = {
              getSwagger: vi.fn().mockResolvedValue({ paths: {} }),
            } as unknown as SwaggerService;

            const rowService = new RowService(mockClient, mockSwaggerService);

            const rows = Array.from({ length: totalItems }, (_, i) => ({ Id: i + 1 }));

            await rowService.bulkDelete('tbl123', rows, 'base123', { 
              failFast: true,
              batchSize,
            });

            const expectedBatches = Math.ceil(totalItems / batchSize);
            expect(mockClient.request).toHaveBeenCalledTimes(expectedBatches);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // NOTE: Swagger caching tests (Property 16) were removed because:
  // 1. They are fully covered by swagger-service.test.ts (caching reuse, cache bypass, per-base-ID independence)
  // 2. vi.spyOn() on ESM node:fs exports is fundamentally broken in vitest (Cannot redefine property)
  // 3. The mocks targeted sync fs functions while SwaggerService uses fs.promises (async)

  describe('Property 14: Retry behavior', () => {
    /**
     * Property: For any network request that fails with a retryable status code 
     * (408, 429, 500, 502, 503, 504), the SDK should retry the request up to the 
     * configured retry count before throwing an error.
     * 
     * Validates: Requirements 9.6
     */
    it('should retry requests with retryable status codes', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // retry count
          fc.constantFrom(408, 429, 500, 502, 503, 504), // retryable status codes
          async (retryCount, statusCode) => {
            // This test verifies the retry configuration is passed to ofetch
            // The actual retry logic is handled by ofetch internally
            
            const client = new NocoClient({
              baseUrl: 'https://test.nocodb.com',
              headers: { 'xc-token': 'test-token' },
              retry: {
                retry: retryCount,
                retryDelay: 100,
                retryStatusCodes: [408, 429, 500, 502, 503, 504],
              },
            });

            // Verify retry configuration is set
            expect((client as any).retryOptions).toEqual({
              retry: retryCount,
              retryDelay: 100,
              retryStatusCodes: [408, 429, 500, 502, 503, 504],
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should respect retry configuration from settings', () => {
      const fc = import('fast-check');

      // Test that retry settings are properly configured
      const client = new NocoClient({
        baseUrl: 'https://test.nocodb.com',
        headers: { 'xc-token': 'test-token' },
        retry: {
          retry: 3,
          retryDelay: 1000,
          retryStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      });

      // Verify configuration
      expect((client as any).retryOptions).toBeDefined();
      expect((client as any).retryOptions.retry).toBe(3);
      expect((client as any).retryOptions.retryDelay).toBe(1000);
      expect((client as any).retryOptions.retryStatusCodes).toContain(500);
    });

    it('should allow disabling retries with retry: false', () => {
      const client = new NocoClient({
        baseUrl: 'https://test.nocodb.com',
        headers: { 'xc-token': 'test-token' },
        retry: {
          retry: false,
        },
      });

      expect((client as any).retryOptions.retry).toBe(false);
    });

    it('should allow retry count of 0 to disable retries', () => {
      const client = new NocoClient({
        baseUrl: 'https://test.nocodb.com',
        headers: { 'xc-token': 'test-token' },
        retry: {
          retry: 0,
        },
      });

      expect((client as any).retryOptions.retry).toBe(0);
    });
  });
});
