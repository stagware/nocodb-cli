/**
 * Base error class for all NocoDB SDK errors.
 * Provides structured error information including error codes, status codes, and additional data.
 */
export class NocoDBError extends Error {
  /**
   * Creates a new NocoDBError instance.
   * 
   * @param message - Human-readable error message
   * @param code - Machine-readable error code for programmatic handling
   * @param statusCode - HTTP status code if applicable
   * @param data - Additional error data (e.g., response body, validation details)
   * 
   * @example
   * ```typescript
   * throw new NocoDBError('Operation failed', 'OPERATION_FAILED', 500, { details: 'Server error' });
   * ```
   */
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'NocoDBError';
  }
}

/**
 * Error thrown when network connectivity issues occur.
 * This includes connection timeouts, DNS failures, and other network-level problems.
 */
export class NetworkError extends NocoDBError {
  /**
   * Creates a new NetworkError instance.
   * 
   * @param message - Human-readable error message
   * @param cause - The underlying error that caused this network error
   * 
   * @example
   * ```typescript
   * try {
   *   await fetch('https://api.example.com');
   * } catch (err) {
   *   throw new NetworkError('Failed to connect to server', err);
   * }
   * ```
   */
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.cause = cause;
  }
}

/**
 * Error thrown when authentication or authorization fails.
 * This includes invalid tokens, expired credentials, and insufficient permissions.
 */
export class AuthenticationError extends NocoDBError {
  /**
   * Creates a new AuthenticationError instance.
   * 
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (typically 401 or 403)
   * @param data - Additional error data from the server response
   * 
   * @example
   * ```typescript
   * throw new AuthenticationError('Invalid API token', 401, { error: 'Token expired' });
   * ```
   */
  constructor(message: string, statusCode: number, data?: unknown) {
    super(message, 'AUTH_ERROR', statusCode, data);
  }
}

/**
 * Error thrown when request validation fails.
 * This includes schema validation errors, missing required fields, and invalid field values.
 */
export class ValidationError extends NocoDBError {
  /**
   * Creates a new ValidationError instance.
   * 
   * @param message - Human-readable error message
   * @param fieldErrors - Optional map of field names to validation error messages
   * 
   * @example
   * ```typescript
   * throw new ValidationError('Invalid request data', {
   *   email: ['Must be a valid email address'],
   *   age: ['Must be a positive number']
   * });
   * ```
   */
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Error thrown when a requested resource is not found.
 * This typically corresponds to HTTP 404 responses.
 */
export class NotFoundError extends NocoDBError {
  /**
   * Creates a new NotFoundError instance.
   * 
   * @param resource - The type of resource that was not found (e.g., 'Base', 'Table', 'Row')
   * @param id - The identifier of the resource that was not found
   * 
   * @example
   * ```typescript
   * throw new NotFoundError('Table', 'tbl_abc123');
   * // Error message: "Table not found: tbl_abc123"
   * ```
   */
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

/**
 * Error thrown when a resource conflict occurs.
 * This includes duplicate key violations, concurrent modification conflicts, and other state conflicts.
 */
export class ConflictError extends NocoDBError {
  /**
   * Creates a new ConflictError instance.
   * 
   * @param message - Human-readable error message
   * @param data - Additional error data from the server response
   * 
   * @example
   * ```typescript
   * throw new ConflictError('Row already exists with this unique key', { key: 'email', value: 'user@example.com' });
   * ```
   */
  constructor(message: string, data?: unknown) {
    super(message, 'CONFLICT', 409, data);
  }
}
