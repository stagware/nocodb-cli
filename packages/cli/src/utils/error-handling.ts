import {
  NocoDBError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@stagware/nocodb-sdk';

/**
 * Formats an error for consistent terminal output.
 * Handles all error types with appropriate context (status code, field errors, etc.).
 * 
 * @param error - The error to format
 * @param verbose - Whether to include full stack traces (defaults to checking --verbose flag in process.argv)
 * @returns Formatted error message for terminal display
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   console.error(formatError(err));
 *   process.exit(1);
 * }
 * ```
 */
export function formatError(error: unknown, verbose?: boolean): string {
  // Check for --verbose flag in process.argv if not explicitly provided
  const isVerbose = verbose ?? process.argv.includes('--verbose');

  const lines: string[] = [];

  if (error instanceof ValidationError) {
    lines.push(`❌ Validation Error: ${error.message}`);
    if (error.statusCode) {
      lines.push(`   Status Code: ${error.statusCode}`);
    }
    if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
      lines.push('   Field Errors:');
      for (const [field, errors] of Object.entries(error.fieldErrors)) {
        for (const err of errors) {
          lines.push(`     - ${field}: ${err}`);
        }
      }
    }
  } else if (error instanceof AuthenticationError) {
    lines.push(`❌ Authentication Error: ${error.message}`);
    if (error.statusCode) {
      lines.push(`   Status Code: ${error.statusCode}`);
    }
    if (error.data) {
      lines.push(`   Details: ${JSON.stringify(error.data)}`);
    }
  } else if (error instanceof NotFoundError) {
    lines.push(`❌ Not Found: ${error.message}`);
    if (error.statusCode) {
      lines.push(`   Status Code: ${error.statusCode}`);
    }
  } else if (error instanceof ConflictError) {
    lines.push(`❌ Conflict Error: ${error.message}`);
    if (error.statusCode) {
      lines.push(`   Status Code: ${error.statusCode}`);
    }
    if (error.data) {
      lines.push(`   Details: ${JSON.stringify(error.data)}`);
    }
  } else if (error instanceof NetworkError) {
    lines.push(`❌ Network Error: ${error.message}`);
    if (error.cause) {
      lines.push(`   Cause: ${error.cause.message}`);
    }
  } else if (error instanceof NocoDBError) {
    lines.push(`❌ ${error.name}: ${error.message}`);
    if (error.code) {
      lines.push(`   Error Code: ${error.code}`);
    }
    if (error.statusCode) {
      lines.push(`   Status Code: ${error.statusCode}`);
    }
    if (error.data) {
      lines.push(`   Details: ${JSON.stringify(error.data)}`);
    }
  } else if (error instanceof Error) {
    lines.push(`❌ Error: ${error.message}`);
  } else {
    lines.push(`❌ Unknown Error: ${String(error)}`);
  }

  // Add stack trace in verbose mode
  if (isVerbose && error instanceof Error && error.stack) {
    lines.push('');
    lines.push('Stack Trace:');
    lines.push(error.stack);
  }

  return lines.join('\n');
}

/**
 * Gets the appropriate exit code for an error type.
 * Different error types map to different exit codes for scripting purposes.
 * 
 * @param error - The error to get exit code for
 * @returns Exit code (1-5 for specific errors, 1 for unknown)
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   console.error(formatError(err));
 *   process.exit(getExitCode(err));
 * }
 * ```
 */
export function getExitCode(error: unknown): number {
  if (error instanceof AuthenticationError) {
    return 2; // Authentication/authorization failure
  }
  if (error instanceof NotFoundError) {
    return 3; // Resource not found
  }
  if (error instanceof ValidationError) {
    return 4; // Invalid input
  }
  if (error instanceof NetworkError) {
    return 5; // Network/connectivity issue
  }
  return 1; // Generic error
}
