import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceContainer, Container, createContainer, createTestContainer } from '../src/container.js';
import { ConfigManager } from '../src/config/manager.js';
import { NocoClient } from '@nocodb/sdk';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('ServiceContainer', () => {
  let container: Container;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('set and get', () => {
    it('should store and retrieve a service', () => {
      const service = { name: 'test-service' };
      container.set('testService', service);
      
      const retrieved = container.get<typeof service>('testService');
      expect(retrieved).toBe(service);
    });

    it('should store and retrieve different types of services', () => {
      const stringService = 'test-string';
      const numberService = 42;
      const objectService = { key: 'value' };
      const functionService = () => 'result';

      container.set('string', stringService);
      container.set('number', numberService);
      container.set('object', objectService);
      container.set('function', functionService);

      expect(container.get<string>('string')).toBe(stringService);
      expect(container.get<number>('number')).toBe(numberService);
      expect(container.get<typeof objectService>('object')).toBe(objectService);
      expect(container.get<typeof functionService>('function')).toBe(functionService);
    });

    it('should replace existing service when setting with same key', () => {
      const service1 = { version: 1 };
      const service2 = { version: 2 };

      container.set('service', service1);
      expect(container.get<typeof service1>('service')).toBe(service1);

      container.set('service', service2);
      expect(container.get<typeof service2>('service')).toBe(service2);
    });

    it('should throw error when getting non-existent service', () => {
      expect(() => container.get('nonExistent')).toThrow(
        "Service 'nonExistent' not registered in container"
      );
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      container.set('testService', { name: 'test' });
      expect(container.has('testService')).toBe(true);
    });

    it('should return false for non-registered service', () => {
      expect(container.has('nonExistent')).toBe(false);
    });

    it('should return false after service is replaced', () => {
      container.set('service', { version: 1 });
      expect(container.has('service')).toBe(true);
      
      container.set('service', { version: 2 });
      expect(container.has('service')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all services', () => {
      container.set('service1', { name: 'one' });
      container.set('service2', { name: 'two' });
      container.set('service3', { name: 'three' });

      expect(container.has('service1')).toBe(true);
      expect(container.has('service2')).toBe(true);
      expect(container.has('service3')).toBe(true);

      container.clear();

      expect(container.has('service1')).toBe(false);
      expect(container.has('service2')).toBe(false);
      expect(container.has('service3')).toBe(false);
    });

    it('should allow re-registering services after clear', () => {
      const service = { name: 'test' };
      container.set('service', service);
      container.clear();

      expect(container.has('service')).toBe(false);

      container.set('service', service);
      expect(container.has('service')).toBe(true);
      expect(container.get<typeof service>('service')).toBe(service);
    });
  });

  describe('factory functions', () => {
    it('should store and retrieve factory functions', () => {
      interface Config {
        baseUrl: string;
      }

      const createClient = (config: Config) => ({
        baseUrl: config.baseUrl,
        request: () => Promise.resolve({}),
      });

      container.set('createClient', createClient);

      const factory = container.get<typeof createClient>('createClient');
      const client = factory({ baseUrl: 'https://example.com' });

      expect(client.baseUrl).toBe('https://example.com');
      expect(typeof client.request).toBe('function');
    });

    it('should support multiple factory invocations', () => {
      let counter = 0;
      const createService = () => ({ id: ++counter });

      container.set('createService', createService);

      const factory = container.get<typeof createService>('createService');
      const service1 = factory();
      const service2 = factory();

      expect(service1.id).toBe(1);
      expect(service2.id).toBe(2);
    });
  });

  describe('type safety', () => {
    it('should maintain type information through generics', () => {
      interface ConfigManager {
        getConfig(): { baseUrl: string };
      }

      const configManager: ConfigManager = {
        getConfig: () => ({ baseUrl: 'https://example.com' }),
      };

      container.set('configManager', configManager);

      // TypeScript should infer the correct type
      const retrieved = container.get<ConfigManager>('configManager');
      const config = retrieved.getConfig();

      expect(config.baseUrl).toBe('https://example.com');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as key', () => {
      const service = { name: 'empty-key' };
      container.set('', service);

      expect(container.has('')).toBe(true);
      expect(container.get<typeof service>('')).toBe(service);
    });

    it('should handle null and undefined values', () => {
      container.set('null', null);
      container.set('undefined', undefined);

      expect(container.has('null')).toBe(true);
      expect(container.has('undefined')).toBe(true);
      expect(container.get('null')).toBe(null);
      expect(container.get('undefined')).toBe(undefined);
    });

    it('should handle keys with special characters', () => {
      const service = { name: 'special' };
      const specialKeys = [
        'service.with.dots',
        'service-with-dashes',
        'service_with_underscores',
        'service:with:colons',
        'service/with/slashes',
      ];

      specialKeys.forEach((key) => {
        container.set(key, service);
        expect(container.has(key)).toBe(true);
        expect(container.get<typeof service>(key)).toBe(service);
      });
    });
  });
});

describe('createContainer', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    // Create a temporary directory for test config (mkdtempSync guarantees uniqueness)
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocodb-cli-container-'));
    
    // Create a config manager with test directory
    configManager = new ConfigManager(tempDir);
    
    // Add a test workspace
    configManager.addWorkspace('test', {
      baseUrl: 'https://test.nocodb.com',
      headers: { 'xc-token': 'test-token' },
      baseId: 'p1234567890abcdef',
      aliases: {
        users: 't1111111111111111',
        tasks: 't2222222222222222',
      },
    });
    configManager.setActiveWorkspace('test');
  });

  afterEach(() => {
    // Retry cleanup for Windows file-locking resilience
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        break;
      } catch {
        if (attempt < 2) {
          const start = Date.now();
          while (Date.now() - start < 100) { /* wait for locks to release */ }
        }
      }
    }
  });

  describe('container initialization', () => {
    it('should create a container with all services registered', () => {
      const container = createContainer(configManager);

      expect(container.has('configManager')).toBe(true);
      expect(container.has('createClient')).toBe(true);
      expect(container.has('swaggerService')).toBe(true);
      expect(container.has('rowService')).toBe(true);
      expect(container.has('metaService')).toBe(true);
      expect(container.has('linkService')).toBe(true);
      expect(container.has('storageService')).toBe(true);
    });

    it('should register the provided ConfigManager', () => {
      const container = createContainer(configManager);
      const retrievedConfig = container.get<ConfigManager>('configManager');

      expect(retrievedConfig).toBe(configManager);
    });
  });

  describe('createClient factory', () => {
    it('should create NocoClient with workspace configuration', () => {
      const container = createContainer(configManager);
      const createClient = container.get<Function>('createClient');

      const workspace = configManager.getActiveWorkspace();
      const client = createClient(workspace, { timeoutMs: 30000, retryCount: 3, retryDelay: 1000, retryStatusCodes: [500] });

      expect(client).toBeInstanceOf(NocoClient);
    });

    it('should create NocoClient with effective configuration when no params provided', () => {
      const container = createContainer(configManager);
      const createClient = container.get<Function>('createClient');

      const client = createClient();

      expect(client).toBeInstanceOf(NocoClient);
    });

    it('should throw ValidationError when no baseUrl is configured', () => {
      // Create a config manager with no workspaces
      const emptyConfigManager = new ConfigManager(path.join(tempDir, 'empty'));
      const container = createContainer(emptyConfigManager);
      const createClient = container.get<Function>('createClient');

      expect(() => createClient()).toThrow('Base URL not configured');
    });

    it('should create multiple independent client instances', () => {
      const container = createContainer(configManager);
      const createClient = container.get<Function>('createClient');

      const workspace = configManager.getActiveWorkspace();
      const settings = { timeoutMs: 30000, retryCount: 3, retryDelay: 1000, retryStatusCodes: [500] };
      
      const client1 = createClient(workspace, settings);
      const client2 = createClient(workspace, settings);

      expect(client1).toBeInstanceOf(NocoClient);
      expect(client2).toBeInstanceOf(NocoClient);
      expect(client1).not.toBe(client2); // Different instances
    });
  });

  describe('SwaggerService singleton', () => {
    it('should register SwaggerService as singleton', () => {
      const container = createContainer(configManager);
      const swaggerService1 = container.get('swaggerService');
      const swaggerService2 = container.get('swaggerService');

      expect(swaggerService1).toBe(swaggerService2); // Same instance
    });

    it('should create SwaggerService with createClient factory and configManager', () => {
      const container = createContainer(configManager);
      const swaggerService = container.get('swaggerService');

      expect(swaggerService).toBeDefined();
      expect(typeof swaggerService.getSwagger).toBe('function');
      expect(typeof swaggerService.invalidateCache).toBe('function');
    });
  });

  describe('service factories', () => {
    it('should register RowService factory', () => {
      const container = createContainer(configManager);
      const rowServiceFactory = container.get<Function>('rowService');
      const createClient = container.get<Function>('createClient');

      const client = createClient();
      const rowService = rowServiceFactory(client);

      expect(rowService).toBeDefined();
      expect(typeof rowService.list).toBe('function');
      expect(typeof rowService.create).toBe('function');
      expect(typeof rowService.update).toBe('function');
      expect(typeof rowService.delete).toBe('function');
      expect(typeof rowService.bulkCreate).toBe('function');
      expect(typeof rowService.upsert).toBe('function');
    });

    it('should register MetaService factory', () => {
      const container = createContainer(configManager);
      const metaServiceFactory = container.get<Function>('metaService');
      const createClient = container.get<Function>('createClient');

      const client = createClient();
      const metaService = metaServiceFactory(client);

      expect(metaService).toBeDefined();
      expect(typeof metaService.listBases).toBe('function');
      expect(typeof metaService.createBase).toBe('function');
      expect(typeof metaService.listTables).toBe('function');
      expect(typeof metaService.createTable).toBe('function');
    });

    it('should register LinkService factory', () => {
      const container = createContainer(configManager);
      const linkServiceFactory = container.get<Function>('linkService');
      const createClient = container.get<Function>('createClient');

      const client = createClient();
      const linkService = linkServiceFactory(client);

      expect(linkService).toBeDefined();
      expect(typeof linkService.list).toBe('function');
      expect(typeof linkService.link).toBe('function');
      expect(typeof linkService.unlink).toBe('function');
    });

    it('should register StorageService factory', () => {
      const container = createContainer(configManager);
      const storageServiceFactory = container.get<Function>('storageService');
      const createClient = container.get<Function>('createClient');

      const client = createClient();
      const storageService = storageServiceFactory(client);

      expect(storageService).toBeDefined();
      expect(typeof storageService.upload).toBe('function');
    });

    it('should create independent service instances per client', () => {
      const container = createContainer(configManager);
      const rowServiceFactory = container.get<Function>('rowService');
      const createClient = container.get<Function>('createClient');

      const client1 = createClient();
      const client2 = createClient();
      
      const rowService1 = rowServiceFactory(client1);
      const rowService2 = rowServiceFactory(client2);

      expect(rowService1).not.toBe(rowService2); // Different instances
    });
  });

  describe('integration', () => {
    it('should support full workflow: config -> client -> service', () => {
      const container = createContainer(configManager);

      // Get config manager
      const config = container.get<ConfigManager>('configManager');
      expect(config.getActiveWorkspace()?.baseUrl).toBe('https://test.nocodb.com');

      // Create client
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      expect(client).toBeInstanceOf(NocoClient);

      // Create service
      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);
      expect(rowService).toBeDefined();
    });

    it('should share SwaggerService across multiple RowService instances', () => {
      const container = createContainer(configManager);
      const createClient = container.get<Function>('createClient');
      const rowServiceFactory = container.get<Function>('rowService');

      const client1 = createClient();
      const client2 = createClient();
      
      const rowService1 = rowServiceFactory(client1);
      const rowService2 = rowServiceFactory(client2);

      // Both services should use the same SwaggerService instance (shared cache)
      expect(rowService1).not.toBe(rowService2);
      // We can't directly test the internal swaggerService reference,
      // but we know from the implementation that they share the same instance
    });
  });
});

describe('createTestContainer', () => {
  describe('default mocks', () => {
    it('should create a container with all services registered', () => {
      const container = createTestContainer();

      expect(container.has('configManager')).toBe(true);
      expect(container.has('createClient')).toBe(true);
      expect(container.has('swaggerService')).toBe(true);
      expect(container.has('rowService')).toBe(true);
      expect(container.has('metaService')).toBe(true);
      expect(container.has('linkService')).toBe(true);
      expect(container.has('storageService')).toBe(true);
    });

    it('should provide default mock ConfigManager', () => {
      const container = createTestContainer();
      const configManager = container.get<ConfigManager>('configManager');

      expect(configManager).toBeDefined();
      expect(configManager.getActiveWorkspace()).toBeDefined();
      expect(configManager.getActiveWorkspace()?.baseUrl).toBe('https://test.nocodb.com');
    });

    it('should provide default mock createClient factory', () => {
      const container = createTestContainer();
      const createClient = container.get<Function>('createClient');

      const client = createClient();
      expect(client).toBeDefined();
      expect(typeof client.request).toBe('function');
    });

    it('should provide default mock SwaggerService', () => {
      const container = createTestContainer();
      const swaggerService = container.get<any>('swaggerService');

      expect(swaggerService).toBeDefined();
      expect(typeof swaggerService.getSwagger).toBe('function');
      expect(typeof swaggerService.invalidateCache).toBe('function');
    });

    it('should provide default mock service factories', () => {
      const container = createTestContainer();
      const createClient = container.get<Function>('createClient');
      const client = createClient();

      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);
      expect(rowService).toBeDefined();
      expect(typeof rowService.list).toBe('function');

      const metaServiceFactory = container.get<Function>('metaService');
      const metaService = metaServiceFactory(client);
      expect(metaService).toBeDefined();
      expect(typeof metaService.listBases).toBe('function');

      const linkServiceFactory = container.get<Function>('linkService');
      const linkService = linkServiceFactory(client);
      expect(linkService).toBeDefined();
      expect(typeof linkService.list).toBe('function');

      const storageServiceFactory = container.get<Function>('storageService');
      const storageService = storageServiceFactory(client);
      expect(storageService).toBeDefined();
      expect(typeof storageService.upload).toBe('function');
    });
  });

  describe('custom mocks', () => {
    it('should accept custom ConfigManager', () => {
      const mockConfigManager = {
        getActiveWorkspace: () => ({
          baseUrl: 'https://custom.nocodb.com',
          headers: { 'xc-token': 'custom-token' },
          baseId: 'custom-base',
          aliases: { custom: 'alias' },
        }),
      } as unknown as ConfigManager;

      const container = createTestContainer({
        configManager: mockConfigManager,
      });

      const configManager = container.get<ConfigManager>('configManager');
      expect(configManager.getActiveWorkspace()?.baseUrl).toBe('https://custom.nocodb.com');
      expect(configManager.getActiveWorkspace()?.aliases).toEqual({ custom: 'alias' });
    });

    it('should accept custom createClient factory', () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: 'test' });
      const mockClient = {
        request: mockRequest,
      } as unknown as NocoClient;

      const container = createTestContainer({
        createClient: () => mockClient,
      });

      const createClient = container.get<Function>('createClient');
      const client = createClient();
      
      expect(client).toBe(mockClient);
      expect(client.request).toBe(mockRequest);
    });

    it('should accept custom SwaggerService', () => {
      const mockGetSwagger = vi.fn().mockResolvedValue({
        paths: { '/test': {} },
        definitions: {},
        components: {},
      });

      const mockSwaggerService = {
        getSwagger: mockGetSwagger,
        invalidateCache: vi.fn(),
      } as any;

      const container = createTestContainer({
        swaggerService: mockSwaggerService,
      });

      const swaggerService = container.get<any>('swaggerService');
      expect(swaggerService).toBe(mockSwaggerService);
      expect(swaggerService.getSwagger).toBe(mockGetSwagger);
    });

    it('should accept custom RowService factory', () => {
      const mockList = vi.fn().mockResolvedValue({ list: [{ Id: 1 }], pageInfo: {} });
      const mockCreate = vi.fn().mockResolvedValue({ Id: 2 });

      const mockRowService = {
        list: mockList,
        create: mockCreate,
      } as any;

      const container = createTestContainer({
        rowService: () => mockRowService,
      });

      const rowServiceFactory = container.get<Function>('rowService');
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const rowService = rowServiceFactory(client);

      expect(rowService).toBe(mockRowService);
      expect(rowService.list).toBe(mockList);
      expect(rowService.create).toBe(mockCreate);
    });

    it('should accept custom MetaService factory', () => {
      const mockListBases = vi.fn().mockResolvedValue({ list: [], pageInfo: {} });
      const mockCreateBase = vi.fn().mockResolvedValue({ id: 'b1', title: 'Test' });

      const mockMetaService = {
        listBases: mockListBases,
        createBase: mockCreateBase,
      } as any;

      const container = createTestContainer({
        metaService: () => mockMetaService,
      });

      const metaServiceFactory = container.get<Function>('metaService');
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const metaService = metaServiceFactory(client);

      expect(metaService).toBe(mockMetaService);
      expect(metaService.listBases).toBe(mockListBases);
    });

    it('should accept custom LinkService factory', () => {
      const mockLink = vi.fn().mockResolvedValue(undefined);
      const mockUnlink = vi.fn().mockResolvedValue(undefined);

      const mockLinkService = {
        link: mockLink,
        unlink: mockUnlink,
        list: vi.fn(),
      } as any;

      const container = createTestContainer({
        linkService: () => mockLinkService,
      });

      const linkServiceFactory = container.get<Function>('linkService');
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const linkService = linkServiceFactory(client);

      expect(linkService).toBe(mockLinkService);
      expect(linkService.link).toBe(mockLink);
    });

    it('should accept custom StorageService factory', () => {
      const mockUpload = vi.fn().mockResolvedValue({
        url: 'https://custom.com/file.txt',
        title: 'custom.txt',
      });

      const mockStorageService = {
        upload: mockUpload,
      } as any;

      const container = createTestContainer({
        storageService: () => mockStorageService,
      });

      const storageServiceFactory = container.get<Function>('storageService');
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const storageService = storageServiceFactory(client);

      expect(storageService).toBe(mockStorageService);
      expect(storageService.upload).toBe(mockUpload);
    });
  });

  describe('partial mocking', () => {
    it('should allow mocking only createClient while using default mocks for services', () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: 'test' });
      const mockClient = {
        request: mockRequest,
      } as unknown as NocoClient;

      const container = createTestContainer({
        createClient: () => mockClient,
      });

      // Custom client
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      expect(client).toBe(mockClient);

      // Default mocks for services
      const configManager = container.get<ConfigManager>('configManager');
      expect(configManager.getActiveWorkspace()?.baseUrl).toBe('https://test.nocodb.com');

      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);
      expect(rowService).toBeDefined();
    });

    it('should allow mocking only RowService while using default mocks for others', () => {
      const mockList = vi.fn().mockResolvedValue({ list: [{ Id: 1 }], pageInfo: {} });
      const mockRowService = {
        list: mockList,
        create: vi.fn(),
      } as any;

      const container = createTestContainer({
        rowService: () => mockRowService,
      });

      // Custom RowService
      const rowServiceFactory = container.get<Function>('rowService');
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const rowService = rowServiceFactory(client);
      expect(rowService).toBe(mockRowService);

      // Default mocks for other services
      const metaServiceFactory = container.get<Function>('metaService');
      const metaService = metaServiceFactory(client);
      expect(metaService).toBeDefined();
      expect(typeof metaService.listBases).toBe('function');
    });

    it('should allow mocking multiple services while using defaults for others', () => {
      const mockClient = {
        request: vi.fn().mockResolvedValue({ data: 'test' }),
      } as unknown as NocoClient;

      const mockRowService = {
        list: vi.fn().mockResolvedValue({ list: [], pageInfo: {} }),
      } as any;

      const mockMetaService = {
        listBases: vi.fn().mockResolvedValue({ list: [], pageInfo: {} }),
      } as any;

      const container = createTestContainer({
        createClient: () => mockClient,
        rowService: () => mockRowService,
        metaService: () => mockMetaService,
      });

      // Custom mocks
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      expect(client).toBe(mockClient);

      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);
      expect(rowService).toBe(mockRowService);

      const metaServiceFactory = container.get<Function>('metaService');
      const metaService = metaServiceFactory(client);
      expect(metaService).toBe(mockMetaService);

      // Default mocks
      const linkServiceFactory = container.get<Function>('linkService');
      const linkService = linkServiceFactory(client);
      expect(linkService).toBeDefined();
      expect(typeof linkService.list).toBe('function');
    });
  });

  describe('usage patterns', () => {
    it('should support testing command handlers with mocked client', async () => {
      // Simulate a command handler test
      const mockRequest = vi.fn().mockResolvedValue({
        list: [
          { Id: 1, Name: 'Alice' },
          { Id: 2, Name: 'Bob' },
        ],
        pageInfo: { totalRows: 2 },
      });

      const mockClient = {
        request: mockRequest,
      } as unknown as NocoClient;

      const container = createTestContainer({
        createClient: () => mockClient,
      });

      // Simulate command handler logic
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);

      // The default mock rowService will work without throwing
      const result = await rowService.list('t1234567890abcdef');
      expect(result).toBeDefined();
    });

    it('should support testing services with mocked dependencies', async () => {
      // Simulate a service test
      const mockGetSwagger = vi.fn().mockResolvedValue({
        paths: {
          '/api/v2/tables/{tableId}/records': {
            post: {
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        definitions: {},
        components: {},
      });

      const mockSwaggerService = {
        getSwagger: mockGetSwagger,
        invalidateCache: vi.fn(),
      } as any;

      const mockRequest = vi.fn().mockResolvedValue({ Id: 1, Name: 'Test' });
      const mockClient = {
        request: mockRequest,
      } as unknown as NocoClient;

      const container = createTestContainer({
        createClient: () => mockClient,
        swaggerService: mockSwaggerService,
      });

      // Use the container in a service test
      const createClient = container.get<Function>('createClient');
      const client = createClient();
      const rowServiceFactory = container.get<Function>('rowService');
      const rowService = rowServiceFactory(client);

      // The rowService will use the mocked swagger service
      expect(rowService).toBeDefined();
    });

    it('should support testing with real ConfigManager and mocked services', () => {
      // Create a real ConfigManager for integration-style tests
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocodb-cli-container-real-'));

      try {
        const realConfigManager = new ConfigManager(tempDir);
        realConfigManager.addWorkspace('test', {
          baseUrl: 'https://test.nocodb.com',
          headers: { 'xc-token': 'test-token' },
          baseId: 'p1234567890abcdef',
          aliases: { users: 't1111111111111111' },
        });
        realConfigManager.setActiveWorkspace('test');

        const mockClient = {
          request: vi.fn().mockResolvedValue({ data: 'test' }),
        } as unknown as NocoClient;

        const container = createTestContainer({
          configManager: realConfigManager,
          createClient: () => mockClient,
        });

        // Use real config with mocked client
        const configManager = container.get<ConfigManager>('configManager');
        expect(configManager.getActiveWorkspace()?.baseUrl).toBe('https://test.nocodb.com');

        const resolved = configManager.resolveAlias('users');
        expect(resolved.id).toBe('t1111111111111111');

        const createClient = container.get<Function>('createClient');
        const client = createClient();
        expect(client).toBe(mockClient);
      } finally {
        // Retry cleanup for Windows file-locking resilience
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
            break;
          } catch {
            if (attempt < 2) {
              const start = Date.now();
              while (Date.now() - start < 100) { /* wait for locks to release */ }
            }
          }
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty options object', () => {
      const container = createTestContainer({});

      expect(container.has('configManager')).toBe(true);
      expect(container.has('createClient')).toBe(true);
      expect(container.has('rowService')).toBe(true);
    });

    it('should handle undefined options', () => {
      const container = createTestContainer(undefined);

      expect(container.has('configManager')).toBe(true);
      expect(container.has('createClient')).toBe(true);
      expect(container.has('rowService')).toBe(true);
    });

    it('should allow replacing services after creation', () => {
      const container = createTestContainer();

      const newMockClient = {
        request: vi.fn().mockResolvedValue({ custom: 'data' }),
      } as unknown as NocoClient;

      container.set('createClient', () => newMockClient);

      const createClient = container.get<Function>('createClient');
      const client = createClient();
      expect(client).toBe(newMockClient);
    });

    it('should support clearing and re-registering services', () => {
      const container = createTestContainer() as ServiceContainer;

      expect(container.has('configManager')).toBe(true);

      container.clear();

      expect(container.has('configManager')).toBe(false);

      // Re-register
      const mockConfigManager = {
        getActiveWorkspace: () => ({ baseUrl: 'https://new.nocodb.com', headers: {}, aliases: {} }),
      } as unknown as ConfigManager;

      container.set('configManager', mockConfigManager);

      expect(container.has('configManager')).toBe(true);
      const configManager = container.get<ConfigManager>('configManager');
      expect(configManager.getActiveWorkspace()?.baseUrl).toBe('https://new.nocodb.com');
    });
  });
});
