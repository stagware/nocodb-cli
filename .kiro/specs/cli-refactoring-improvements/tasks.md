# Implementation Plan: CLI Refactoring Improvements

## Overview

This implementation plan refactors the nocodb-cli TypeScript project to improve type safety, configuration management, error handling, test coverage, code organization, and dependency injection. The refactoring maintains backward compatibility while establishing patterns that improve maintainability and developer experience.

The implementation follows an incremental approach:
1. Add SDK type system and error handling
2. Refactor configuration management
3. Extract service layer from command handlers
4. Implement dependency injection container
5. Add comprehensive test coverage
6. Add documentation

## Tasks

- [x] 1. Set up SDK type system and error classes
  - [x] 1.1 Create SDK types directory and entity interfaces
    - Create `packages/sdk/src/types/entities.ts` with interfaces for Base, Table, View, Column, Filter, Sort, Row
    - Define ColumnType and ViewType union types
    - Define ComparisonOperator type for filters
    - _Requirements: 1.1, 1.8, 1.9, 1.10_

  - [x] 1.2 Create SDK response type interfaces
    - Create `packages/sdk/src/types/responses.ts` with ListResponse, PageInfo, BulkCreateResponse, BulkUpdateResponse, BulkDeleteResponse, ErrorResponse
    - _Requirements: 1.4, 1.5_

  - [x] 1.3 Create SDK error classes
    - Create `packages/sdk/src/errors.ts` with NocoDBError base class
    - Implement NetworkError, AuthenticationError, ValidationError, NotFoundError, ConflictError classes
    - Add error code and statusCode properties
    - _Requirements: 3.1, 3.2, 3.9_

  - [x] 1.4 Update SDK index.ts to export types and errors
    - Export all entity types, response types, and error classes
    - _Requirements: 1.6_

  - [x] 1.5 Write property test for error classes
    - **Property 7: Error code presence**
    - **Validates: Requirements 3.9**

- [x] 2. Add typed methods to SDK API classes
  - [x] 2.1 Update NocoClient.request to support generic type parameters
    - Modify request method signature to accept generic type parameter for response typing
    - Update return type from `Promise<unknown>` to `Promise<T>`
    - _Requirements: 1.7_

  - [x] 2.2 Update MetaApi with typed method signatures
    - Update all MetaApi methods (listBases, createBase, getBase, updateBase, deleteBase, etc.) to return typed responses
    - Replace `unknown` return types with specific entity types (Base, Table, View, Column, Filter, Sort)
    - _Requirements: 1.2_

  - [x] 2.3 Update DataApi with typed method signatures
    - Update DataApi methods to return typed responses (ListResponse<Row>, Row, BulkCreateResponse, etc.)
    - _Requirements: 1.3_

  - [x] 2.4 Implement HTTP error mapping in NocoClient
    - Add error response handling that maps status codes to typed errors
    - Throw AuthenticationError for 401/403, NotFoundError for 404, ConflictError for 409, ValidationError for 400
    - Include status code, message, and response data in errors
    - _Requirements: 3.2_

  - [x] 2.5 Write property test for HTTP error mapping
    - **Property 5: HTTP error mapping**
    - **Validates: Requirements 3.2**

  - [x] 2.6 Write unit tests for typed SDK methods
    - Test MetaApi methods return correct types
    - Test DataApi methods return correct types
    - Test error scenarios
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Checkpoint - Ensure SDK tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement unified configuration system
  - [x] 4.1 Create configuration types and interfaces
    - Create `packages/cli/src/config/types.ts` with WorkspaceConfig, GlobalSettings, UnifiedConfig interfaces
    - _Requirements: 2.1_

  - [x] 4.2 Implement ConfigManager class
    - Create `packages/cli/src/config/manager.ts` with ConfigManager class
    - Implement loadOrMigrate, migrateFromLegacy, getActiveWorkspace, setActiveWorkspace, addWorkspace methods
    - Implement resolveAlias method with clear resolution rules (explicit namespace > active workspace > workspace-level)
    - Implement getEffectiveConfig with precedence: CLI flags > workspace config > global config > defaults
    - Implement save method for atomic config updates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.3 Implement legacy config migration logic
    - Implement loadLegacyConfig, loadLegacySettings, loadLegacyAliases methods
    - Migrate legacy config.json (Conf-based) to unified format
    - Migrate legacy settings.json to unified format
    - Migrate legacy aliases from config.v2.json to unified format
    - Create default workspace from legacy global config if present
    - _Requirements: 2.6, 2.7_

  - [x] 4.4 Add configuration validation
    - Validate workspace config values (baseUrl format, headers structure)
    - Validate global settings (positive timeouts, valid retry counts)
    - Throw ValidationError with clear messages for invalid values
    - _Requirements: 2.9_

  - [x] 4.5 Write property test for configuration persistence
    - **Property 1: Configuration persistence round-trip**
    - **Validates: Requirements 2.2**

  - [x] 4.6 Write property test for configuration precedence
    - **Property 2: Configuration precedence order**
    - **Validates: Requirements 2.5**

  - [x] 4.7 Write property test for legacy migration
    - **Property 3: Legacy configuration migration**
    - **Validates: Requirements 2.6**

  - [x] 4.8 Write property test for configuration validation
    - **Property 4: Configuration validation**
    - **Validates: Requirements 2.9**

  - [x] 4.9 Write unit tests for ConfigManager
    - Test workspace management (add, switch, resolve)
    - Test alias resolution with different scenarios
    - Test effective config calculation
    - _Requirements: 4.7_

- [x] 5. Create utility modules
  - [x] 5.1 Create formatting utilities
    - Create `packages/cli/src/utils/formatting.ts` with formatJson, formatCsv, formatTable functions
    - Extract formatting logic from lib.ts
    - _Requirements: 5.5, 5.6_

  - [x] 5.2 Create parsing utilities
    - Create `packages/cli/src/utils/parsing.ts` with parseJsonInput, parseKeyValue functions
    - Extract parsing logic from lib.ts
    - _Requirements: 5.5, 5.6_

  - [x] 5.3 Create swagger utilities
    - Create `packages/cli/src/utils/swagger.ts` with findOperation, validateRequestBody functions
    - Extract swagger logic from lib.ts
    - _Requirements: 5.5, 5.6_

  - [x] 5.4 Write unit tests for utility modules
    - Test formatting functions with various inputs
    - Test parsing functions with valid and invalid inputs
    - Test swagger utilities
    - _Requirements: 4.7_

- [x] 6. Implement service layer
  - [x] 6.1 Create SwaggerService
    - Create `packages/cli/src/services/swagger-service.ts`
    - Implement getSwagger method with caching
    - Implement cache invalidation with --no-cache flag
    - _Requirements: 5.1, 5.2, 10.5, 10.6, 10.7_

  - [x] 6.2 Create RowService
    - Create `packages/cli/src/services/row-service.ts` with RowService class
    - Implement list, create, update, delete methods
    - Implement bulkCreate, bulkUpdate, bulkDelete methods
    - Implement upsert method with match field logic
    - Implement bulkUpsert method
    - Include swagger validation in create/update operations
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.3 Implement bulk operation error handling in RowService
    - Add error tracking for bulk operations (success/failure counts)
    - Implement --fail-fast and --continue-on-error behavior
    - Return detailed error information for failed items
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.4 Create MetaService
    - Create `packages/cli/src/services/meta-service.ts` with MetaService class
    - Implement methods for bases, tables, views, columns, filters, sorts operations
    - Delegate to SDK MetaApi methods
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.5 Create LinkService
    - Create `packages/cli/src/services/link-service.ts` with LinkService class
    - Implement link, unlink, list methods
    - Delegate to SDK DataApi methods
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.6 Create StorageService
    - Create `packages/cli/src/services/storage-service.ts` with StorageService class
    - Implement upload method
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.7 Write property test for bulk operation error reporting
    - **Property 8: Bulk operation error reporting**
    - **Validates: Requirements 3.8, 9.2, 9.3**

  - [x] 6.8 Write property test for bulk operation continuation
    - **Property 13: Bulk operation continuation**
    - **Validates: Requirements 9.1**

  - [x] 6.9 Write unit tests for service classes
    - Test RowService methods with mocked NocoClient
    - Test MetaService methods with mocked NocoClient
    - Test LinkService methods with mocked NocoClient
    - Test StorageService methods with mocked NocoClient
    - Test SwaggerService caching behavior
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 7. Checkpoint - Ensure service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement dependency injection container
  - [x] 8.1 Create Container interface and ServiceContainer class
    - Create `packages/cli/src/container.ts` with Container interface
    - Implement ServiceContainer class with get, set, has, clear methods
    - _Requirements: 6.1, 6.7_

  - [x] 8.2 Implement createContainer factory function
    - Register ConfigManager in container
    - Register NocoClient factory function
    - Register service factories (RowService, MetaService, LinkService, StorageService, SwaggerService)
    - _Requirements: 6.2, 6.3, 6.10_

  - [x] 8.3 Create testing container helper
    - Implement createTestContainer function for easy mock injection
    - _Requirements: 6.5, 6.8_

  - [x] 8.4 Write unit tests for container
    - Test service registration and resolution
    - Test factory functions
    - Test testing container with mocks
    - _Requirements: 6.8_

- [x] 9. Refactor command handlers to use services and container
  - [x] 9.1 Refactor rows commands
    - Update `packages/cli/src/commands/rows.ts` to use container
    - Replace direct NocoClient usage with RowService
    - Simplify command handlers to: parse arguments, call service, format output
    - Use ConfigManager for alias resolution
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.2 Refactor meta-crud commands
    - Update `packages/cli/src/commands/meta-crud/*.ts` to use container
    - Replace direct NocoClient usage with MetaService
    - Simplify command handlers
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.3 Refactor links commands
    - Update `packages/cli/src/commands/links.ts` to use container
    - Replace direct NocoClient usage with LinkService
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.4 Refactor storage commands
    - Update `packages/cli/src/commands/storage.ts` to use container
    - Replace direct NocoClient usage with StorageService
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.5 Refactor api commands
    - Update `packages/cli/src/commands/api.ts` to use container
    - Use SwaggerService for swagger operations
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.6 Refactor workspace-alias commands
    - Update `packages/cli/src/commands/workspace-alias.ts` to use ConfigManager
    - Replace direct file operations with ConfigManager methods
    - _Requirements: 5.3, 5.4, 6.3, 6.4_

  - [x] 9.7 Write integration tests for command handlers
    - Test end-to-end command execution with mocked HTTP
    - Test error handling in commands
    - Test output formatting
    - _Requirements: 4.9_

- [x] 10. Implement CLI error handling
  - [x] 10.1 Create error formatting utility
    - Create `packages/cli/src/utils/error-handling.ts` with formatError function
    - Implement consistent error formatting for all error types
    - Show error type, message, status code, field errors as appropriate
    - _Requirements: 3.4, 3.5_

  - [x] 10.2 Add error handling to all command handlers
    - Wrap command handler logic in try-catch blocks
    - Use formatError utility for consistent error display
    - Remove withErrorHandler wrapper pattern
    - Set appropriate exit codes for different error types
    - _Requirements: 3.6, 3.7_

  - [x] 10.3 Add --verbose flag support for error stack traces
    - Add global --verbose flag to CLI
    - Show full stack traces when --verbose is enabled
    - _Requirements: 3.10_

  - [x] 10.4 Write property test for error formatting consistency
    - **Property 6: Error formatting consistency**
    - **Validates: Requirements 3.4, 3.5**

- [x] 11. Refactor CLI index.ts
  - [x] 11.1 Modularize bootstrap logic
    - Extract config initialization into separate function
    - Extract container creation into separate function
    - Extract command registration into separate function
    - Limit index.ts to orchestration only
    - _Requirements: 5.7, 5.9_

  - [x] 11.2 Update command registration to use container
    - Pass container to all command registration functions
    - Remove large dependency objects from registration functions
    - _Requirements: 6.3, 6.6_

- [x] 12. Add JSDoc documentation
  - [x] 12.1 Add JSDoc to SDK classes and methods
    - Document NocoClient class and all methods
    - Document MetaApi class and all methods
    - Document DataApi class and all methods
    - Document all type interfaces
    - Include parameter descriptions, return types, error conditions, and usage examples
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.9_

  - [x] 12.2 Add JSDoc to CLI services
    - Document all service classes (RowService, MetaService, LinkService, StorageService, SwaggerService)
    - Document all public methods with examples
    - _Requirements: 7.6, 7.8_

  - [x] 12.3 Add JSDoc to CLI utilities
    - Document all utility functions
    - Document container usage pattern
    - _Requirements: 7.7, 7.10_

- [x] 13. Add performance optimizations
  - [x] 13.1 Implement batch size configuration for bulk operations
    - Add --batch-size flag to bulk operation commands
    - Implement pagination in RowService bulk methods
    - Default batch size to 1000 records
    - _Requirements: 10.2, 10.3_

  - [x] 13.2 Implement retry logic with logging
    - Add retry attempt logging when --verbose is enabled
    - Ensure SDK retry configuration is respected
    - _Requirements: 9.6, 9.7, 9.8_

  - [x] 13.3 Add timing information for verbose mode
    - Log operation timing when --verbose is enabled
    - _Requirements: 10.10_

  - [x] 13.4 Write property test for batch size configuration
    - **Property 15: Batch size configuration**
    - **Validates: Requirements 10.2**

  - [x] 13.5 Write property test for swagger caching
    - **Property 16: Swagger caching**
    - **Validates: Requirements 10.5**

  - [x] 13.6 Write property test for retry behavior
    - **Property 14: Retry behavior**
    - **Validates: Requirements 9.6**

- [-] 14. Backward compatibility verification
  - [x] 14.1 Run existing e2e-cli.mjs test script
    - Execute `npm run e2e` to verify backward compatibility
    - Fix any breaking changes discovered
    - _Requirements: 8.8_

  - [ ] 14.2 Write property test for command compatibility
    - **Property 9: Command compatibility**
    - **Validates: Requirements 8.1**

  - [ ] 14.3 Write property test for configuration file compatibility
    - **Property 10: Configuration file compatibility**
    - **Validates: Requirements 8.2**

  - [ ] 14.4 Write property test for environment variable compatibility
    - **Property 11: Environment variable compatibility**
    - **Validates: Requirements 8.4**

  - [ ] 14.5 Write property test for output format compatibility
    - **Property 12: Output format compatibility**
    - **Validates: Requirements 8.5**

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Verify code coverage meets 80% target for core business logic
  - Run e2e test: `npm run e2e`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The refactoring maintains backward compatibility throughout
- Services are extracted before command handlers are refactored to minimize disruption
- Configuration migration happens automatically on first use
- All breaking changes are avoided per requirement 8
