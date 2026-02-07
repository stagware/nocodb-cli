import { describe, it, expect } from 'vitest';

/**
 * Test suite to verify all types and error classes are properly exported
 * from the SDK's main index.ts file.
 */
describe('SDK Exports', () => {
  it('should export all entity types', async () => {
    const module = await import('../src/index.js');
    
    // Entity types should be available as type exports
    // We can't directly test type exports at runtime, but we can verify
    // the module loads without errors
    expect(module).toBeDefined();
  });

  it('should export all error classes', async () => {
    const {
      NocoDBError,
      NetworkError,
      AuthenticationError,
      ValidationError,
      NotFoundError,
      ConflictError,
    } = await import('../src/index.js');
    
    // Verify error classes are constructors
    expect(NocoDBError).toBeDefined();
    expect(typeof NocoDBError).toBe('function');
    expect(NetworkError).toBeDefined();
    expect(typeof NetworkError).toBe('function');
    expect(AuthenticationError).toBeDefined();
    expect(typeof AuthenticationError).toBe('function');
    expect(ValidationError).toBeDefined();
    expect(typeof ValidationError).toBe('function');
    expect(NotFoundError).toBeDefined();
    expect(typeof NotFoundError).toBe('function');
    expect(ConflictError).toBeDefined();
    expect(typeof ConflictError).toBe('function');
  });

  it('should allow creating error instances from exported classes', async () => {
    const {
      NocoDBError,
      NetworkError,
      AuthenticationError,
      ValidationError,
      NotFoundError,
      ConflictError,
    } = await import('../src/index.js');
    
    // Test NocoDBError
    const baseError = new NocoDBError('Test', 'TEST_CODE', 500);
    expect(baseError).toBeInstanceOf(Error);
    expect(baseError).toBeInstanceOf(NocoDBError);
    expect(baseError.code).toBe('TEST_CODE');
    
    // Test NetworkError
    const networkError = new NetworkError('Network failed');
    expect(networkError).toBeInstanceOf(NocoDBError);
    expect(networkError.code).toBe('NETWORK_ERROR');
    
    // Test AuthenticationError
    const authError = new AuthenticationError('Auth failed', 401);
    expect(authError).toBeInstanceOf(NocoDBError);
    expect(authError.code).toBe('AUTH_ERROR');
    expect(authError.statusCode).toBe(401);
    
    // Test ValidationError
    const validationError = new ValidationError('Validation failed', { field: ['error'] });
    expect(validationError).toBeInstanceOf(NocoDBError);
    expect(validationError.code).toBe('VALIDATION_ERROR');
    expect(validationError.fieldErrors).toEqual({ field: ['error'] });
    
    // Test NotFoundError
    const notFoundError = new NotFoundError('Table', 'tbl_123');
    expect(notFoundError).toBeInstanceOf(NocoDBError);
    expect(notFoundError.code).toBe('NOT_FOUND');
    expect(notFoundError.statusCode).toBe(404);
    
    // Test ConflictError
    const conflictError = new ConflictError('Conflict occurred');
    expect(conflictError).toBeInstanceOf(NocoDBError);
    expect(conflictError.code).toBe('CONFLICT');
    expect(conflictError.statusCode).toBe(409);
  });

  it('should export NocoClient and API classes', async () => {
    const { NocoClient, MetaApi, DataApi } = await import('../src/index.js');
    
    expect(NocoClient).toBeDefined();
    expect(typeof NocoClient).toBe('function');
    expect(MetaApi).toBeDefined();
    expect(typeof MetaApi).toBe('function');
    expect(DataApi).toBeDefined();
    expect(typeof DataApi).toBe('function');
  });

  it('should export utility functions', async () => {
    const { normalizeBaseUrl, parseHeader } = await import('../src/index.js');
    
    expect(normalizeBaseUrl).toBeDefined();
    expect(typeof normalizeBaseUrl).toBe('function');
    expect(parseHeader).toBeDefined();
    expect(typeof parseHeader).toBe('function');
  });
});
