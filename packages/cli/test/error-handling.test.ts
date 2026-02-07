/**
 * Tests for error handling utilities.
 * 
 * This test suite validates:
 * - Error formatting consistency across all error types
 * - Exit code mapping for different error types
 * - Verbose mode stack trace inclusion
 * - Property 6: Error formatting consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NocoDBError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@nocodb/sdk';
import { formatError, getExitCode } from '../src/utils/error-handling.js';

describe('Error Handling', () => {
  let originalArgv: string[];

  beforeEach(() => {
    // Save original argv
    originalArgv = [...process.argv];
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
  });

  describe('formatError', () => {
    it('should format ValidationError with field errors', () => {
      const error = new ValidationError('Invalid input', {
        email: ['Must be a valid email'],
        age: ['Must be positive'],
      });

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Validation Error: Invalid input');
      expect(formatted).toContain('Status Code: 400');
      expect(formatted).toContain('Field Errors:');
      expect(formatted).toContain('email: Must be a valid email');
      expect(formatted).toContain('age: Must be positive');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format AuthenticationError with status code', () => {
      const error = new AuthenticationError('Invalid token', 401, { error: 'Token expired' });

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Authentication Error: Invalid token');
      expect(formatted).toContain('Status Code: 401');
      expect(formatted).toContain('Details: {"error":"Token expired"}');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format NotFoundError', () => {
      const error = new NotFoundError('Table', 'tbl_123');

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Not Found: Table not found: tbl_123');
      expect(formatted).toContain('Status Code: 404');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format ConflictError with data', () => {
      const error = new ConflictError('Duplicate key', { key: 'email', value: 'test@example.com' });

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Conflict Error: Duplicate key');
      expect(formatted).toContain('Status Code: 409');
      expect(formatted).toContain('Details:');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format NetworkError with cause', () => {
      const cause = new Error('Connection refused');
      const error = new NetworkError('Failed to connect', cause);

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Network Error: Failed to connect');
      expect(formatted).toContain('Cause: Connection refused');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format generic NocoDBError', () => {
      const error = new NocoDBError('Something went wrong', 'GENERIC_ERROR', 500, { detail: 'info' });

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ NocoDBError: Something went wrong');
      expect(formatted).toContain('Error Code: GENERIC_ERROR');
      expect(formatted).toContain('Status Code: 500');
      expect(formatted).toContain('Details:');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format generic Error', () => {
      const error = new Error('Generic error message');

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Error: Generic error message');
      expect(formatted).not.toContain('Stack Trace:');
    });

    it('should format unknown error types', () => {
      const error = 'String error';

      const formatted = formatError(error, false);

      expect(formatted).toContain('❌ Unknown Error: String error');
    });

    it('should include stack trace when verbose is true', () => {
      const error = new Error('Test error');

      const formatted = formatError(error, true);

      expect(formatted).toContain('❌ Error: Test error');
      expect(formatted).toContain('Stack Trace:');
      expect(formatted).toContain('at '); // Stack trace line
    });

    it('should check --verbose flag in process.argv when verbose not provided', () => {
      const error = new Error('Test error');

      // Without --verbose flag
      process.argv = ['node', 'nocodb'];
      const formattedWithoutFlag = formatError(error);
      expect(formattedWithoutFlag).not.toContain('Stack Trace:');

      // With --verbose flag
      process.argv = ['node', 'nocodb', '--verbose'];
      const formattedWithFlag = formatError(error);
      expect(formattedWithFlag).toContain('Stack Trace:');
    });
  });

  describe('getExitCode', () => {
    it('should return 2 for AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token', 401);
      expect(getExitCode(error)).toBe(2);
    });

    it('should return 3 for NotFoundError', () => {
      const error = new NotFoundError('Table', 'tbl_123');
      expect(getExitCode(error)).toBe(3);
    });

    it('should return 4 for ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(getExitCode(error)).toBe(4);
    });

    it('should return 5 for NetworkError', () => {
      const error = new NetworkError('Connection failed');
      expect(getExitCode(error)).toBe(5);
    });

    it('should return 1 for generic errors', () => {
      const error = new Error('Generic error');
      expect(getExitCode(error)).toBe(1);
    });

    it('should return 1 for unknown error types', () => {
      const error = 'String error';
      expect(getExitCode(error)).toBe(1);
    });
  });

  /**
   * Property 6: Error formatting consistency
   * 
   * **Validates: Requirements 3.4, 3.5**
   * 
   * For any error type (NetworkError, AuthenticationError, ValidationError, 
   * NotFoundError, ConflictError), the CLI should format it for terminal output 
   * with error type, message, and relevant context (status code, field errors) 
   * in a consistent structure.
   */
  describe('Property 6: Error formatting consistency', () => {
    it('should format all error types consistently', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // ValidationError with field errors
            fc.record({
              type: fc.constant('validation'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              fieldErrors: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 })
              ),
            }),
            // AuthenticationError
            fc.record({
              type: fc.constant('authentication'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              statusCode: fc.constantFrom(401, 403),
              data: fc.option(fc.object(), { nil: undefined }),
            }),
            // NotFoundError
            fc.record({
              type: fc.constant('notfound'),
              resource: fc.constantFrom('Base', 'Table', 'View', 'Column', 'Row'),
              id: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            // ConflictError
            fc.record({
              type: fc.constant('conflict'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              data: fc.option(fc.object(), { nil: undefined }),
            }),
            // NetworkError
            fc.record({
              type: fc.constant('network'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              hasCause: fc.boolean(),
            }),
            // Generic NocoDBError
            fc.record({
              type: fc.constant('generic'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              code: fc.string({ minLength: 1, maxLength: 30 }),
              statusCode: fc.option(fc.integer({ min: 400, max: 599 }), { nil: undefined }),
              data: fc.option(fc.object(), { nil: undefined }),
            })
          ),
          async (errorSpec) => {
            // Create error based on spec
            let error: Error;
            switch (errorSpec.type) {
              case 'validation':
                error = new ValidationError(errorSpec.message, errorSpec.fieldErrors);
                break;
              case 'authentication':
                error = new AuthenticationError(errorSpec.message, errorSpec.statusCode, errorSpec.data);
                break;
              case 'notfound':
                error = new NotFoundError(errorSpec.resource, errorSpec.id);
                break;
              case 'conflict':
                error = new ConflictError(errorSpec.message, errorSpec.data);
                break;
              case 'network':
                error = new NetworkError(
                  errorSpec.message,
                  errorSpec.hasCause ? new Error('Cause error') : undefined
                );
                break;
              case 'generic':
                error = new NocoDBError(
                  errorSpec.message,
                  errorSpec.code,
                  errorSpec.statusCode,
                  errorSpec.data
                );
                break;
            }

            // Format error
            const formatted = formatError(error, false);

            // Verify consistent structure
            // 1. Should start with error indicator
            expect(formatted).toMatch(/^❌/);

            // 2. Should contain error type and message
            expect(formatted).toContain(error.message);

            // 3. Should have consistent line structure (newlines for multi-line output)
            const lines = formatted.split('\n');
            expect(lines.length).toBeGreaterThan(0);

            // 4. First line should contain error type and message
            expect(lines[0]).toContain('❌');
            expect(lines[0]).toContain(error.message);

            // 5. Additional context lines should be indented
            if (lines.length > 1) {
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim().length > 0) {
                  expect(lines[i]).toMatch(/^\s+/); // Should start with whitespace
                }
              }
            }

            // 6. Should not contain stack trace when verbose is false
            expect(formatted).not.toContain('Stack Trace:');

            // 7. Type-specific validations
            if (error instanceof ValidationError && error.statusCode) {
              expect(formatted).toContain(`Status Code: ${error.statusCode}`);
            }
            if (error instanceof AuthenticationError && error.statusCode) {
              expect(formatted).toContain(`Status Code: ${error.statusCode}`);
            }
            if (error instanceof NotFoundError && error.statusCode) {
              expect(formatted).toContain(`Status Code: ${error.statusCode}`);
            }
            if (error instanceof ConflictError && error.statusCode) {
              expect(formatted).toContain(`Status Code: ${error.statusCode}`);
            }
            if (error instanceof NocoDBError && error.code && !(error instanceof NotFoundError) && !(error instanceof ValidationError) && !(error instanceof AuthenticationError) && !(error instanceof ConflictError) && !(error instanceof NetworkError)) {
              // Only check for error code display on generic NocoDBError, not specialized subclasses
              expect(formatted).toContain(`Error Code: ${error.code}`);
            }
          }
        )
      );
    });

    it('should consistently handle verbose mode', async () => {
      const fc = await import('fast-check');

      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({ type: fc.constant('validation'), message: fc.string({ minLength: 1 }) }),
            fc.record({ type: fc.constant('authentication'), message: fc.string({ minLength: 1 }) }),
            fc.record({ type: fc.constant('notfound'), resource: fc.string({ minLength: 1 }), id: fc.string({ minLength: 1 }) }),
            fc.record({ type: fc.constant('conflict'), message: fc.string({ minLength: 1 }) }),
            fc.record({ type: fc.constant('network'), message: fc.string({ minLength: 1 }) })
          ),
          fc.boolean(),
          async (errorSpec, verbose) => {
            // Create error
            let error: Error;
            switch (errorSpec.type) {
              case 'validation':
                error = new ValidationError(errorSpec.message);
                break;
              case 'authentication':
                error = new AuthenticationError(errorSpec.message, 401);
                break;
              case 'notfound':
                error = new NotFoundError(errorSpec.resource, errorSpec.id);
                break;
              case 'conflict':
                error = new ConflictError(errorSpec.message);
                break;
              case 'network':
                error = new NetworkError(errorSpec.message);
                break;
            }

            // Format with verbose flag
            const formatted = formatError(error, verbose);

            // Verify verbose behavior is consistent
            if (verbose) {
              expect(formatted).toContain('Stack Trace:');
              expect(formatted).toContain('at '); // Stack trace line
            } else {
              expect(formatted).not.toContain('Stack Trace:');
            }
          }
        )
      );
    });
  });
});
