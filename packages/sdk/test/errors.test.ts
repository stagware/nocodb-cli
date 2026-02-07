import { describe, it, expect } from 'vitest';
import {
  NocoDBError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../src/errors';

describe('NocoDBError', () => {
  it('should create error with all properties', () => {
    const error = new NocoDBError('Test error', 'TEST_CODE', 500, { detail: 'test' });
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.data).toEqual({ detail: 'test' });
    expect(error.name).toBe('NocoDBError');
  });

  it('should create error without optional properties', () => {
    const error = new NocoDBError('Test error', 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBeUndefined();
    expect(error.data).toBeUndefined();
  });

  it('should have error code property', () => {
    const error = new NocoDBError('Test', 'CODE');
    expect(error.code).toBeTruthy();
    expect(typeof error.code).toBe('string');
  });
});

describe('NetworkError', () => {
  it('should create network error with cause', () => {
    const cause = new Error('Connection timeout');
    const error = new NetworkError('Failed to connect', cause);
    
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe('Failed to connect');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.cause).toBe(cause);
    expect(error.statusCode).toBeUndefined();
  });

  it('should create network error without cause', () => {
    const error = new NetworkError('Network unavailable');
    
    expect(error.message).toBe('Network unavailable');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.cause).toBeUndefined();
  });

  it('should have error code', () => {
    const error = new NetworkError('Test');
    expect(error.code).toBe('NETWORK_ERROR');
  });
});

describe('AuthenticationError', () => {
  it('should create auth error with 401 status', () => {
    const error = new AuthenticationError('Invalid token', 401, { error: 'Token expired' });
    
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Invalid token');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.data).toEqual({ error: 'Token expired' });
  });

  it('should create auth error with 403 status', () => {
    const error = new AuthenticationError('Insufficient permissions', 403);
    
    expect(error.message).toBe('Insufficient permissions');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(403);
  });

  it('should have error code', () => {
    const error = new AuthenticationError('Test', 401);
    expect(error.code).toBe('AUTH_ERROR');
  });
});

describe('ValidationError', () => {
  it('should create validation error with field errors', () => {
    const fieldErrors = {
      email: ['Must be a valid email'],
      age: ['Must be positive', 'Must be a number'],
    };
    const error = new ValidationError('Validation failed', fieldErrors);
    
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it('should create validation error without field errors', () => {
    const error = new ValidationError('Invalid request');
    
    expect(error.message).toBe('Invalid request');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fieldErrors).toBeUndefined();
  });

  it('should have error code', () => {
    const error = new ValidationError('Test');
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('NotFoundError', () => {
  it('should create not found error with resource and id', () => {
    const error = new NotFoundError('Table', 'tbl_abc123');
    
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Table not found: tbl_abc123');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('should format message correctly for different resources', () => {
    const baseError = new NotFoundError('Base', 'base_xyz');
    const viewError = new NotFoundError('View', 'view_123');
    
    expect(baseError.message).toBe('Base not found: base_xyz');
    expect(viewError.message).toBe('View not found: view_123');
  });

  it('should have error code', () => {
    const error = new NotFoundError('Resource', 'id');
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('should create conflict error with data', () => {
    const data = { key: 'email', value: 'user@example.com' };
    const error = new ConflictError('Duplicate key violation', data);
    
    expect(error).toBeInstanceOf(NocoDBError);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('Duplicate key violation');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.data).toEqual(data);
  });

  it('should create conflict error without data', () => {
    const error = new ConflictError('Resource conflict');
    
    expect(error.message).toBe('Resource conflict');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.data).toBeUndefined();
  });

  it('should have error code', () => {
    const error = new ConflictError('Test');
    expect(error.code).toBe('CONFLICT');
  });
});

describe('Error inheritance', () => {
  it('should allow catching specific error types', () => {
    const error = new ValidationError('Test');
    
    try {
      throw error;
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(NocoDBError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('should allow catching all NocoDB errors', () => {
    const errors = [
      new NetworkError('Network'),
      new AuthenticationError('Auth', 401),
      new ValidationError('Validation'),
      new NotFoundError('Resource', 'id'),
      new ConflictError('Conflict'),
    ];

    errors.forEach(error => {
      try {
        throw error;
      } catch (err) {
        expect(err).toBeInstanceOf(NocoDBError);
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});

describe('Error code presence (Property 7)', () => {
  it('should ensure all error types have non-empty error codes', () => {
    const errors = [
      new NocoDBError('Test', 'CUSTOM_CODE'),
      new NetworkError('Network'),
      new AuthenticationError('Auth', 401),
      new ValidationError('Validation'),
      new NotFoundError('Resource', 'id'),
      new ConflictError('Conflict'),
    ];

    errors.forEach(error => {
      expect(error.code).toBeTruthy();
      expect(typeof error.code).toBe('string');
      expect(error.code.length).toBeGreaterThan(0);
    });
  });

  it('should have unique error codes for different error types', () => {
    const codes = new Set([
      new NetworkError('Test').code,
      new AuthenticationError('Test', 401).code,
      new ValidationError('Test').code,
      new NotFoundError('Test', 'id').code,
      new ConflictError('Test').code,
    ]);

    // All error codes should be unique
    expect(codes.size).toBe(5);
  });
});

describe('Property-based test: Error code presence', () => {
  /**
   * **Validates: Requirements 3.9**
   * 
   * Property 7: Error code presence
   * For any NocoDBError thrown by the SDK, it should include a non-empty 
   * error code field for programmatic error handling.
   */
  it('Property 7: All NocoDBError instances have non-empty error codes', async () => {
    const fc = await import('fast-check');

    // Generator for arbitrary error messages
    const messageArb = fc.string({ minLength: 1, maxLength: 100 });
    
    // Generator for arbitrary error codes
    const codeArb = fc.string({ minLength: 1, maxLength: 50 });
    
    // Generator for HTTP status codes
    const statusCodeArb = fc.integer({ min: 100, max: 599 });
    
    // Generator for resource names
    const resourceArb = fc.string({ minLength: 1, maxLength: 50 });
    
    // Generator for resource IDs
    const idArb = fc.string({ minLength: 1, maxLength: 100 });
    
    // Generator for arbitrary data objects
    const dataArb = fc.oneof(
      fc.constant(undefined),
      fc.record({
        detail: fc.string(),
        extra: fc.anything(),
      })
    );
    
    // Generator for field errors
    const fieldErrorsArb = fc.oneof(
      fc.constant(undefined),
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 })
      )
    );

    // Test NocoDBError base class
    await fc.assert(
      fc.property(messageArb, codeArb, statusCodeArb, dataArb, (message, code, statusCode, data) => {
        const error = new NocoDBError(message, code, statusCode, data);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe(code);
      }),
      { numRuns: 100 }
    );

    // Test NetworkError
    await fc.assert(
      fc.property(messageArb, (message) => {
        const error = new NetworkError(message);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe('NETWORK_ERROR');
      }),
      { numRuns: 100 }
    );

    // Test AuthenticationError
    await fc.assert(
      fc.property(messageArb, statusCodeArb, dataArb, (message, statusCode, data) => {
        const error = new AuthenticationError(message, statusCode, data);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe('AUTH_ERROR');
      }),
      { numRuns: 100 }
    );

    // Test ValidationError
    await fc.assert(
      fc.property(messageArb, fieldErrorsArb, (message, fieldErrors) => {
        const error = new ValidationError(message, fieldErrors);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe('VALIDATION_ERROR');
      }),
      { numRuns: 100 }
    );

    // Test NotFoundError
    await fc.assert(
      fc.property(resourceArb, idArb, (resource, id) => {
        const error = new NotFoundError(resource, id);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe('NOT_FOUND');
      }),
      { numRuns: 100 }
    );

    // Test ConflictError
    await fc.assert(
      fc.property(messageArb, dataArb, (message, data) => {
        const error = new ConflictError(message, data);
        
        // Property: Error code must be non-empty string
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.code).toBe('CONFLICT');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Error codes are consistent across multiple instantiations', async () => {
    const fc = await import('fast-check');

    const messageArb = fc.string({ minLength: 1, maxLength: 100 });

    // Test that the same error type always produces the same error code
    await fc.assert(
      fc.property(messageArb, (message) => {
        const error1 = new NetworkError(message);
        const error2 = new NetworkError(message);
        
        // Property: Same error type should have same error code
        expect(error1.code).toBe(error2.code);
        expect(error1.code).toBe('NETWORK_ERROR');
      }),
      { numRuns: 50 }
    );

    await fc.assert(
      fc.property(messageArb, fc.integer({ min: 100, max: 599 }), (message, status) => {
        const error1 = new AuthenticationError(message, status);
        const error2 = new AuthenticationError(message, status);
        
        // Property: Same error type should have same error code
        expect(error1.code).toBe(error2.code);
        expect(error1.code).toBe('AUTH_ERROR');
      }),
      { numRuns: 50 }
    );
  });

  it('Property 7: Error codes are distinct for different error types', async () => {
    const fc = await import('fast-check');

    const messageArb = fc.string({ minLength: 1, maxLength: 100 });

    // Test that different error types have different error codes
    await fc.assert(
      fc.property(messageArb, (message) => {
        const networkError = new NetworkError(message);
        const authError = new AuthenticationError(message, 401);
        const validationError = new ValidationError(message);
        const notFoundError = new NotFoundError('Resource', 'id');
        const conflictError = new ConflictError(message);

        const codes = [
          networkError.code,
          authError.code,
          validationError.code,
          notFoundError.code,
          conflictError.code,
        ];

        // Property: All error codes should be unique
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(5);
        
        // Property: All codes should be non-empty
        codes.forEach(code => {
          expect(code).toBeTruthy();
          expect(typeof code).toBe('string');
          expect(code.length).toBeGreaterThan(0);
        });
      }),
      { numRuns: 50 }
    );
  });
});
