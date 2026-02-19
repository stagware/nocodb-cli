/**
 * Dependency injection container for managing shared dependencies.
 * 
 * The container provides a service locator pattern implementation that allows
 * components to resolve dependencies without tight coupling. This improves
 * testability by enabling easy mock injection.
 * 
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 * container.set('configManager', new ConfigManager());
 * const config = container.get<ConfigManager>('configManager');
 * ```
 */

import { NocoClient, ValidationError } from '@stagware/nocodb-sdk';
import { SwaggerService } from './services/swagger-service.js';
import { RowService } from './services/row-service.js';
import { MetaService } from './services/meta-service.js';
import { LinkService } from './services/link-service.js';
import { StorageService } from './services/storage-service.js';
import { SchemaService } from './services/schema-service.js';
import type { ConfigManager } from './config/manager.js';
import type { WorkspaceConfig, GlobalSettings } from './config/types.js';

/**
 * Container interface for dependency injection.
 * 
 * Provides methods to register, retrieve, and check for services.
 */
export interface Container {
  /**
   * Retrieves a service from the container.
   * 
   * @template T - The type of the service to retrieve
   * @param key - The unique identifier for the service
   * @returns The registered service instance
   * @throws {Error} If the service is not registered
   * 
   * @example
   * ```typescript
   * const configManager = container.get<ConfigManager>('configManager');
   * ```
   */
  get<T>(key: string): T;

  /**
   * Registers a service in the container.
   * 
   * @template T - The type of the service to register
   * @param key - The unique identifier for the service
   * @param value - The service instance or factory function to register
   * 
   * @example
   * ```typescript
   * container.set('configManager', new ConfigManager());
   * container.set('createClient', (workspace) => new NocoClient(workspace));
   * ```
   */
  set<T>(key: string, value: T): void;

  /**
   * Checks if a service is registered in the container.
   * 
   * @param key - The unique identifier for the service
   * @returns True if the service is registered, false otherwise
   * 
   * @example
   * ```typescript
   * if (container.has('configManager')) {
   *   const config = container.get<ConfigManager>('configManager');
   * }
   * ```
   */
  has(key: string): boolean;

  /**
   * Removes all services from the container.
   * 
   * This is primarily useful for testing to ensure a clean state
   * between test cases.
   * 
   * @example
   * ```typescript
   * afterEach(() => {
   *   container.clear();
   * });
   * ```
   */
  clear(): void;
}

/**
 * Implementation of the Container interface using a Map for service storage.
 * 
 * ServiceContainer provides a simple, type-safe dependency injection container
 * that stores services by string keys. Services can be any type, including
 * factory functions that create instances on demand.
 * 
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 * 
 * // Register a singleton service
 * container.set('configManager', new ConfigManager());
 * 
 * // Register a factory function
 * container.set('createClient', (workspace: WorkspaceConfig) => {
 *   return new NocoClient({ baseUrl: workspace.baseUrl });
 * });
 * 
 * // Retrieve services
 * const config = container.get<ConfigManager>('configManager');
 * const createClient = container.get<Function>('createClient');
 * const client = createClient(workspace);
 * ```
 */
export class ServiceContainer implements Container {
  private services = new Map<string, unknown>();

  /**
   * Retrieves a service from the container.
   * 
   * @template T - The type of the service to retrieve
   * @param key - The unique identifier for the service
   * @returns The registered service instance
   * @throws {Error} If the service is not registered in the container
   */
  get<T>(key: string): T {
    if (!this.services.has(key)) {
      throw new Error(`Service '${key}' not registered in container`);
    }
    return this.services.get(key) as T;
  }

  /**
   * Registers a service in the container.
   * 
   * If a service with the same key already exists, it will be replaced.
   * 
   * @template T - The type of the service to register
   * @param key - The unique identifier for the service
   * @param value - The service instance or factory function to register
   */
  set<T>(key: string, value: T): void {
    this.services.set(key, value);
  }

  /**
   * Checks if a service is registered in the container.
   * 
   * @param key - The unique identifier for the service
   * @returns True if the service is registered, false otherwise
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Removes all services from the container.
   * 
   * This method is primarily useful for testing to ensure a clean state
   * between test cases. In production code, containers are typically
   * created once and used throughout the application lifecycle.
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * Factory function to create and initialize a dependency injection container.
 * 
 * This function creates a ServiceContainer and registers all core services:
 * - ConfigManager: Configuration management
 * - createClient: Factory function for creating NocoClient instances
 * - SwaggerService: Swagger document fetching and caching
 * - Service factories: RowService, MetaService, LinkService, StorageService
 * 
 * The container follows these patterns:
 * - ConfigManager is a singleton (one instance shared across all operations)
 * - SwaggerService is a singleton (shares cache across operations)
 * - createClient is a factory function that creates NocoClient instances per-request
 * - Other services are factory functions that accept a NocoClient and return service instances
 * 
 * @param configManager - ConfigManager instance to register in the container
 * @returns Initialized ServiceContainer with all services registered
 * 
 * @example
 * ```typescript
 * // Create a container
 * const configManager = new ConfigManager();
 * const container = createContainer(configManager);
 * 
 * // Get the config manager
 * const config = container.get<ConfigManager>('configManager');
 * 
 * // Create a client using the factory
 * const createClient = container.get<Function>('createClient');
 * const client = createClient(workspace, settings);
 * 
 * // Create a service using its factory
 * const rowServiceFactory = container.get<Function>('rowService');
 * const rowService = rowServiceFactory(client);
 * ```
 */
export function createContainer(configManager: ConfigManager): Container {
  const container = new ServiceContainer();

  // Register ConfigManager singleton
  container.set('configManager', configManager);

  // Register NocoClient factory function
  // This factory creates NocoClient instances with workspace and settings context
  container.set('createClient', (workspace?: WorkspaceConfig, settings?: GlobalSettings) => {
    // Get effective configuration if not provided
    const effectiveConfig = configManager.getEffectiveConfig(settings || {});
    const ws = workspace || effectiveConfig.workspace;
    const effectiveSettings = settings || effectiveConfig.settings;

    // Validate that we have a baseUrl
    if (!ws?.baseUrl) {
      throw new ValidationError('Base URL not configured. Set up a workspace first.');
    }

    // Create NocoClient with workspace configuration and settings
    return new NocoClient({
      baseUrl: ws.baseUrl,
      headers: ws.headers || {},
      timeoutMs: effectiveSettings.timeoutMs,
      retry: {
        retry: effectiveSettings.retryCount === 0 ? false : effectiveSettings.retryCount,
        retryDelay: effectiveSettings.retryDelay,
        retryStatusCodes: effectiveSettings.retryStatusCodes,
      },
    });
  });

  // Register SwaggerService singleton
  // SwaggerService is created once and shares cache across all operations
  const createClient = container.get<(workspace?: WorkspaceConfig, settings?: GlobalSettings) => NocoClient>('createClient');
  container.set('swaggerService', new SwaggerService(createClient, configManager));

  // Register RowService factory
  // Factory function that accepts a NocoClient and returns a RowService instance
  container.set('rowService', (client: NocoClient) => {
    const swaggerService = container.get<SwaggerService>('swaggerService');
    return new RowService(client, swaggerService);
  });

  // Register MetaService factory
  // Factory function that accepts a NocoClient and returns a MetaService instance
  container.set('metaService', (client: NocoClient) => {
    return new MetaService(client);
  });

  // Register LinkService factory
  // Factory function that accepts a NocoClient and returns a LinkService instance
  container.set('linkService', (client: NocoClient) => {
    return new LinkService(client);
  });

  // Register StorageService factory
  // Factory function that accepts a NocoClient and returns a StorageService instance
  container.set('storageService', (client: NocoClient) => {
    return new StorageService(client);
  });

  // Register SchemaService factory
  // Factory function that accepts a NocoClient and returns a SchemaService instance
  container.set('schemaService', (client: NocoClient) => {
    return new SchemaService(client);
  });

  return container;
}

/**
 * Options for creating a test container with mock services.
 * 
 * All properties are optional. If not provided, default test implementations
 * will be used. This allows partial mocking - only mock what you need for
 * your specific test case.
 */
export interface TestContainerOptions {
  /**
   * Mock ConfigManager instance.
   * If not provided, a default mock will be created.
   */
  configManager?: ConfigManager;

  /**
   * Mock factory function for creating NocoClient instances.
   * If not provided, a default mock client factory will be used.
   * 
   * @example
   * ```typescript
   * const mockClient = { request: vi.fn() };
   * const container = createTestContainer({
   *   createClient: () => mockClient
   * });
   * ```
   */
  createClient?: (workspace?: WorkspaceConfig, settings?: GlobalSettings) => NocoClient;

  /**
   * Mock SwaggerService instance.
   * If not provided, a default mock will be created.
   */
  swaggerService?: SwaggerService;

  /**
   * Mock factory function for creating RowService instances.
   * If not provided, a default mock will be used.
   * 
   * @example
   * ```typescript
   * const mockRowService = { list: vi.fn(), create: vi.fn() };
   * const container = createTestContainer({
   *   rowService: () => mockRowService
   * });
   * ```
   */
  rowService?: (client: NocoClient) => RowService;

  /**
   * Mock factory function for creating MetaService instances.
   * If not provided, a default mock will be used.
   */
  metaService?: (client: NocoClient) => MetaService;

  /**
   * Mock factory function for creating LinkService instances.
   * If not provided, a default mock will be used.
   */
  linkService?: (client: NocoClient) => LinkService;

  /**
   * Mock factory function for creating StorageService instances.
   * If not provided, a default mock will be used.
   */
  storageService?: (client: NocoClient) => StorageService;

  /**
   * Mock factory function for creating SchemaService instances.
   * If not provided, a default mock will be used.
   */
  schemaService?: (client: NocoClient) => SchemaService;
}

/**
 * Creates a test container with mock services for easy testing.
 * 
 * This function simplifies test setup by allowing you to provide only the
 * mocks you need for your specific test case. Any services not provided
 * will use default mock implementations.
 * 
 * The function supports partial mocking - you can mock just the services
 * you need to control in your test, while other services will use default
 * mocks that won't interfere with your test.
 * 
 * @param options - Optional mock services to inject into the container
 * @returns ServiceContainer with mock services registered
 * 
 * @example
 * ```typescript
 * // Test with mocked NocoClient
 * const mockClient = { 
 *   request: vi.fn().mockResolvedValue({ list: [], pageInfo: {} })
 * };
 * const container = createTestContainer({
 *   createClient: () => mockClient
 * });
 * 
 * // Test with mocked RowService
 * const mockRowService = { 
 *   list: vi.fn().mockResolvedValue({ list: [], pageInfo: {} }),
 *   create: vi.fn().mockResolvedValue({ Id: 1 })
 * };
 * const container = createTestContainer({
 *   rowService: () => mockRowService
 * });
 * 
 * // Test with mocked ConfigManager
 * const mockConfig = new ConfigManager('/tmp/test-config');
 * mockConfig.addWorkspace('test', {
 *   baseUrl: 'https://test.nocodb.com',
 *   headers: { 'xc-token': 'test-token' },
 *   aliases: {}
 * });
 * const container = createTestContainer({
 *   configManager: mockConfig
 * });
 * 
 * // Test with multiple mocks
 * const container = createTestContainer({
 *   createClient: () => mockClient,
 *   rowService: () => mockRowService,
 *   configManager: mockConfig
 * });
 * ```
 */
export function createTestContainer(options: TestContainerOptions = {}): Container {
  const container = new ServiceContainer();

  // Register ConfigManager (mock or default)
  const configManager = options.configManager || createDefaultMockConfigManager();
  container.set('configManager', configManager);

  // Register createClient factory (mock or default)
  const createClient = options.createClient || createDefaultMockClientFactory();
  container.set('createClient', createClient);

  // Register SwaggerService (mock or default)
  const swaggerService = options.swaggerService || createDefaultMockSwaggerService();
  container.set('swaggerService', swaggerService);

  // Register RowService factory (mock or default)
  const rowService = options.rowService || createDefaultMockRowServiceFactory();
  container.set('rowService', rowService);

  // Register MetaService factory (mock or default)
  const metaService = options.metaService || createDefaultMockMetaServiceFactory();
  container.set('metaService', metaService);

  // Register LinkService factory (mock or default)
  const linkService = options.linkService || createDefaultMockLinkServiceFactory();
  container.set('linkService', linkService);

  // Register StorageService factory (mock or default)
  const storageService = options.storageService || createDefaultMockStorageServiceFactory();
  container.set('storageService', storageService);

  // Register SchemaService factory (mock or default)
  const schemaService = options.schemaService || createDefaultMockSchemaServiceFactory();
  container.set('schemaService', schemaService);

  return container;
}

/**
 * Creates a default mock ConfigManager for testing.
 * 
 * The mock ConfigManager has a single test workspace configured with
 * basic settings. This is suitable for most tests that don't need
 * specific configuration behavior.
 * 
 * @returns Mock ConfigManager with test workspace
 */
function createDefaultMockConfigManager(): ConfigManager {
  const defaultWorkspace: WorkspaceConfig = {
    baseUrl: 'https://test.nocodb.com',
    headers: { 'xc-token': 'test-token' },
    baseId: 'p1234567890abcdef',
    aliases: {},
  };
  const defaultSettings: GlobalSettings = {
    timeoutMs: 30000,
    retryCount: 3,
    retryDelay: 1000,
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
  };

  // Create a minimal mock that satisfies the ConfigManager interface
  // In real tests, users should provide their own mock with specific behavior
  return {
    getActiveWorkspace: () => defaultWorkspace,
    getActiveWorkspaceName: () => 'test',
    setActiveWorkspace: () => {},
    addWorkspace: () => {},
    removeWorkspace: () => false,
    listWorkspaces: () => ['test'],
    getWorkspace: () => defaultWorkspace,
    resolveAlias: (input: string) => ({ id: input, workspace: defaultWorkspace }),
    setAlias: () => {},
    removeAlias: () => false,
    getEffectiveConfig: () => ({ workspace: defaultWorkspace, settings: defaultSettings }),
    getSettings: () => defaultSettings,
    updateSettings: () => {},
    getConfigDir: () => '/tmp/nocodb-cli-test',
  } as unknown as ConfigManager;
}

/**
 * Creates a default mock NocoClient factory for testing.
 * 
 * The mock client has a request method that returns an empty response.
 * Tests that need specific request behavior should provide their own mock.
 * 
 * @returns Mock NocoClient factory function
 */
function createDefaultMockClientFactory(): (workspace?: WorkspaceConfig, settings?: GlobalSettings) => NocoClient {
  return () => {
    const calls: Array<{ method: string; path: string; options?: unknown }> = [];
    return {
      request: async (method: string, path: string, options?: unknown) => {
        calls.push({ method, path, options });
        // Return a realistic empty list response for GET requests
        if (method === 'GET') {
          return { list: [], pageInfo: { totalRows: 0 } };
        }
        return {};
      },
      _calls: calls, // Exposed for test assertions
    } as unknown as NocoClient;
  };
}

/**
 * Creates a default mock SwaggerService for testing.
 * 
 * The mock service has getSwagger and invalidateCache methods that do nothing.
 * Tests that need specific swagger behavior should provide their own mock.
 * 
 * @returns Mock SwaggerService instance
 */
function createDefaultMockSwaggerService(): SwaggerService {
  return {
    getSwagger: async () => ({ paths: {}, definitions: {}, components: { schemas: {} } }),
    ensureSwaggerCache: async () => {},
    invalidateCache: async () => false,
    getCacheDir: () => '/tmp/nocodb-cli-test/cache',
  } as unknown as SwaggerService;
}

/**
 * Creates a default mock RowService factory for testing.
 * 
 * The mock service has all RowService methods that return empty responses.
 * Tests that need specific row behavior should provide their own mock.
 * 
 * @returns Mock RowService factory function
 */
function createDefaultMockRowServiceFactory(): (client: NocoClient) => RowService {
  return () => ({
    list: async () => ({ list: [], pageInfo: { totalRows: 0 } }),
    listAll: async () => ({ list: [], pageInfo: { totalRows: 0 } }),
    create: async (tableId: string, body: unknown) => ({ Id: 1, ...(body as Record<string, unknown>) }),
    update: async (tableId: string, body: unknown) => ({ Id: 1, ...(body as Record<string, unknown>) }),
    delete: async () => ({ Id: 1 }),
    bulkCreate: async (_t: string, rows: unknown[]) => ({ created: rows.length, errors: [], data: rows }),
    bulkUpdate: async (_t: string, rows: unknown[]) => ({ updated: rows.length, errors: [], data: rows }),
    bulkDelete: async (_t: string, rows: unknown[]) => ({ deleted: rows.length, errors: [] }),
    upsert: async (tableId: string, body: unknown) => ({ Id: 1, ...(body as Record<string, unknown>) }),
    bulkUpsert: async (_t: string, rows: unknown[]) => ({ created: rows.length, updated: 0, errors: [], data: rows }),
  } as unknown as RowService);
}

/**
 * Creates a default mock MetaService factory for testing.
 * 
 * The mock service has all MetaService methods that return empty responses.
 * Tests that need specific meta behavior should provide their own mock.
 * 
 * @returns Mock MetaService factory function
 */
function createDefaultMockMetaServiceFactory(): (client: NocoClient) => MetaService {
  return () => ({
    listBases: async () => ({ list: [], pageInfo: {} }),
    createBase: async () => ({ id: 'b1', title: 'Test Base' }),
    getBase: async () => ({ id: 'b1', title: 'Test Base' }),
    updateBase: async () => ({ id: 'b1', title: 'Test Base' }),
    deleteBase: async () => {},
    listTables: async () => ({ list: [], pageInfo: {} }),
    createTable: async () => ({ id: 't1', title: 'Test Table', base_id: 'b1', table_name: 'test_table' }),
    getTable: async () => ({ id: 't1', title: 'Test Table', base_id: 'b1', table_name: 'test_table' }),
    updateTable: async () => ({ id: 't1', title: 'Test Table', base_id: 'b1', table_name: 'test_table' }),
    deleteTable: async () => {},
  } as unknown as MetaService);
}

/**
 * Creates a default mock LinkService factory for testing.
 * 
 * The mock service has all LinkService methods that return empty responses.
 * Tests that need specific link behavior should provide their own mock.
 * 
 * @returns Mock LinkService factory function
 */
function createDefaultMockLinkServiceFactory(): (client: NocoClient) => LinkService {
  return () => ({
    list: async () => ({ list: [], pageInfo: {} }),
    link: async () => {},
    unlink: async () => {},
  } as unknown as LinkService);
}

/**
 * Creates a default mock StorageService factory for testing.
 * 
 * The mock service has an upload method that returns a mock file response.
 * Tests that need specific storage behavior should provide their own mock.
 * 
 * @returns Mock StorageService factory function
 */
function createDefaultMockStorageServiceFactory(): (client: NocoClient) => StorageService {
  return () => ({
    upload: async () => ({ url: 'https://example.com/file.txt', title: 'file.txt' }),
  } as unknown as StorageService);
}

/**
 * Creates a default mock SchemaService factory for testing.
 * 
 * @returns Mock SchemaService factory function
 */
function createDefaultMockSchemaServiceFactory(): (client: NocoClient) => SchemaService {
  return () => ({
    introspectTable: async () => ({
      id: 't1',
      title: 'Test Table',
      table_name: 'test_table',
      columns: [],
    }),
  } as unknown as SchemaService);
}
