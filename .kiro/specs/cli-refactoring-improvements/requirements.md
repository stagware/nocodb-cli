# Requirements Document

## Introduction

This document specifies requirements for refactoring and improving the nocodb-cli TypeScript project. The CLI provides programmatic access to NocoDB v2 APIs through both a TypeScript SDK and command-line interface. The current implementation has several technical debt issues that impact maintainability, type safety, testability, and developer experience. This refactoring will address these issues while maintaining backward compatibility with existing functionality.

## Glossary

- **SDK**: The TypeScript software development kit package (`@nocodb/sdk`) that provides HTTP client and API abstractions
- **CLI**: The command-line interface package (`@nocodb/cli`) that wraps the SDK for terminal usage
- **NocoClient**: The main HTTP client class in the SDK that handles requests to NocoDB APIs
- **MetaApi**: SDK class providing methods for metadata operations (bases, tables, views, columns, filters, sorts)
- **DataApi**: SDK class providing methods for data operations (rows, links)
- **Workspace**: A named configuration containing baseUrl, token, baseId, and aliases for a NocoDB instance
- **Alias**: A user-defined friendly name that maps to a UUID (for bases, tables, views, etc.)
- **Command_Handler**: A function that processes CLI command arguments and executes operations
- **Dependency_Container**: A service locator pattern implementation for managing shared dependencies
- **Type_Definition**: TypeScript interface or type that describes the shape of data structures
- **Error_Type**: A custom error class that represents a specific failure scenario
- **Property_Test**: A test that validates universal properties across randomly generated inputs
- **Mock**: A test double that simulates external dependencies for isolated testing

## Requirements

### Requirement 1: Type Safety for API Responses

**User Story:** As a developer using the SDK, I want strongly-typed API responses, so that I can catch type errors at compile time and have better IDE autocomplete support.

#### Acceptance Criteria

1. THE SDK SHALL define TypeScript interfaces for all NocoDB API entity types (Base, Table, View, Column, Filter, Sort, Row)
2. WHEN MetaApi methods return data, THE SDK SHALL return typed responses instead of `unknown`
3. WHEN DataApi methods return data, THE SDK SHALL return typed responses instead of `unknown`
4. THE SDK SHALL define interfaces for paginated list responses with pageInfo metadata
5. THE SDK SHALL define interfaces for bulk operation responses (created, updated, deleted counts)
6. THE SDK SHALL export all type definitions for use by CLI and external consumers
7. WHEN NocoClient.request is called, THE SDK SHALL support generic type parameters for response typing
8. THE SDK SHALL define union types for column types (text, number, date, link, etc.)
9. THE SDK SHALL define interfaces for view types (grid, form, gallery, kanban)
10. THE SDK SHALL define interfaces for filter operators and comparison types

### Requirement 2: Unified Configuration Management

**User Story:** As a CLI user, I want a single, clear configuration system, so that I don't have to understand multiple overlapping config mechanisms.

#### Acceptance Criteria

1. THE CLI SHALL consolidate config.ts, settings.ts, and aliases.ts into a unified configuration module
2. WHEN a user sets configuration, THE CLI SHALL store all settings in a single JSON file structure
3. THE CLI SHALL maintain workspace-scoped configuration (baseUrl, headers, baseId, aliases per workspace)
4. THE CLI SHALL maintain global settings (timeout, retry configuration)
5. WHEN resolving configuration values, THE CLI SHALL follow a clear precedence: CLI flags > workspace config > global config > defaults
6. THE CLI SHALL provide a migration path from legacy config.json to the new unified format
7. WHEN a legacy config file exists, THE CLI SHALL automatically migrate it on first use
8. THE CLI SHALL provide commands to view the effective configuration with precedence applied
9. THE CLI SHALL validate configuration values and provide clear error messages for invalid settings
10. THE CLI SHALL document the configuration file format and precedence rules in code comments

### Requirement 3: Structured Error Handling

**User Story:** As a CLI user, I want consistent, informative error messages, so that I can quickly understand and fix issues.

#### Acceptance Criteria

1. THE SDK SHALL define custom error classes for different failure scenarios (NetworkError, AuthenticationError, ValidationError, NotFoundError, ConflictError)
2. WHEN an HTTP error occurs, THE SDK SHALL throw a typed error with status code, message, and response data
3. WHEN a validation error occurs, THE SDK SHALL throw a ValidationError with field-level details
4. THE CLI SHALL catch all error types and format them consistently for terminal output
5. WHEN displaying errors, THE CLI SHALL show error type, message, and relevant context (status code, field errors)
6. THE CLI SHALL use structured error handling throughout all command handlers
7. THE CLI SHALL remove the withErrorHandler wrapper in favor of consistent try-catch patterns
8. WHEN an error occurs during bulk operations, THE CLI SHALL report which items succeeded and which failed
9. THE SDK SHALL include error codes for programmatic error handling by consumers
10. THE CLI SHALL provide a --verbose flag that shows full error stack traces for debugging

### Requirement 4: Comprehensive Test Coverage

**User Story:** As a developer maintaining the codebase, I want comprehensive test coverage, so that I can refactor confidently without breaking functionality.

#### Acceptance Criteria

1. THE SDK SHALL have unit tests for NocoClient covering request methods, retry logic, and timeout handling
2. THE SDK SHALL have unit tests for MetaApi covering all CRUD operations
3. THE SDK SHALL have unit tests for DataApi covering link operations
4. THE CLI SHALL have unit tests for all meta CRUD command handlers
5. THE CLI SHALL have unit tests for row command handlers covering list, create, update, delete, upsert, and bulk operations
6. THE CLI SHALL have unit tests for workspace and alias management
7. THE CLI SHALL have unit tests for configuration management
8. THE CLI SHALL use a proper mocking library (vitest mocks) instead of manual HTTP server mocking
9. THE CLI SHALL have integration tests that verify end-to-end command execution
10. THE CLI SHALL achieve minimum 80% code coverage for core business logic

### Requirement 5: Improved Code Organization

**User Story:** As a developer working on the codebase, I want clear separation of concerns, so that I can understand and modify code more easily.

#### Acceptance Criteria

1. THE CLI SHALL extract business logic from command handlers into separate service modules
2. THE CLI SHALL create a services directory containing modules for: row operations, meta operations, link operations, storage operations
3. WHEN a command handler executes, THE CLI SHALL delegate business logic to service modules
4. THE CLI SHALL limit command handler responsibilities to: parsing arguments, calling services, formatting output
5. THE CLI SHALL refactor lib.ts into focused utility modules (formatting, validation, swagger)
6. THE CLI SHALL create separate modules for: output formatting (CSV, table, JSON), input parsing (JSON, key-value), swagger operations
7. THE CLI SHALL limit individual source files to maximum 300 lines of code
8. THE CLI SHALL use consistent naming conventions: services use noun names (RowService), utilities use verb names (formatOutput)
9. THE CLI SHALL organize imports in consistent order: external dependencies, SDK imports, local imports
10. THE CLI SHALL add JSDoc comments to all public functions and classes

### Requirement 6: Dependency Injection Container

**User Story:** As a developer writing tests, I want easy dependency injection, so that I can test components in isolation without complex setup.

#### Acceptance Criteria

1. THE CLI SHALL implement a dependency injection container for managing shared dependencies
2. THE CLI SHALL register services in the container: NocoClient, MetaApi, DataApi, configuration, settings
3. WHEN command handlers need dependencies, THE CLI SHALL resolve them from the container
4. THE CLI SHALL support container scoping for request-level dependencies
5. THE CLI SHALL provide a testing container that allows easy mock injection
6. THE CLI SHALL remove the pattern of passing 10+ dependencies through registration functions
7. THE CLI SHALL define clear interfaces for injectable services
8. WHEN tests run, THE CLI SHALL use the testing container with mocked dependencies
9. THE CLI SHALL document the container usage pattern with examples
10. THE CLI SHALL ensure the container is initialized before command registration

### Requirement 7: API Documentation

**User Story:** As a developer integrating the SDK, I want comprehensive API documentation, so that I understand how to use all features correctly.

#### Acceptance Criteria

1. THE SDK SHALL have JSDoc comments for all public classes, methods, and interfaces
2. WHEN documenting methods, THE SDK SHALL include parameter descriptions, return type descriptions, and usage examples
3. THE SDK SHALL document error conditions that methods may throw
4. THE SDK SHALL provide code examples in JSDoc for common use cases
5. THE SDK SHALL generate TypeScript declaration files (.d.ts) with complete type information
6. THE CLI SHALL have JSDoc comments for all service classes and public methods
7. THE CLI SHALL document command handler patterns and conventions
8. THE CLI SHALL provide inline code examples for complex operations (upsert, bulk operations)
9. THE SDK SHALL include a types.ts file that exports all type definitions with documentation
10. THE CLI SHALL document the dependency injection container usage pattern

### Requirement 8: Backward Compatibility

**User Story:** As an existing CLI user, I want the refactored version to work with my existing scripts, so that I don't have to rewrite my automation.

#### Acceptance Criteria

1. THE CLI SHALL maintain all existing command names and argument formats
2. THE CLI SHALL maintain all existing configuration file locations and formats (with migration support)
3. WHEN legacy config files exist, THE CLI SHALL automatically migrate them without user intervention
4. THE CLI SHALL maintain all existing environment variable names (NOCO_QUIET, NOCODB_SETTINGS_DIR, NOCO_CONFIG_DIR)
5. THE CLI SHALL maintain all existing output formats (JSON, CSV, table)
6. THE SDK SHALL maintain all existing public API methods and signatures
7. THE SDK SHALL maintain all existing exported types and interfaces (BaseRef, TableRef, ViewRef, etc.)
8. WHEN breaking changes are necessary, THE CLI SHALL provide deprecation warnings for one major version
9. THE CLI SHALL include migration documentation for any behavior changes
10. THE CLI SHALL run the existing e2e-cli.mjs test script successfully after refactoring

### Requirement 9: Error Recovery and Resilience

**User Story:** As a CLI user running bulk operations, I want the tool to handle partial failures gracefully, so that I don't lose all progress when one item fails.

#### Acceptance Criteria

1. WHEN bulk operations encounter errors, THE CLI SHALL continue processing remaining items
2. WHEN bulk operations complete, THE CLI SHALL report success and failure counts separately
3. WHEN bulk operations fail, THE CLI SHALL include details about which specific items failed and why
4. THE CLI SHALL provide a --fail-fast flag that stops on first error for bulk operations
5. THE CLI SHALL provide a --continue-on-error flag (default) that processes all items despite errors
6. WHEN network errors occur, THE SDK SHALL retry according to configured retry settings
7. WHEN retry attempts are exhausted, THE SDK SHALL throw a clear error indicating retry failure
8. THE CLI SHALL log retry attempts when --verbose flag is enabled
9. WHEN upsert operations detect conflicts, THE CLI SHALL retry with updated data as currently implemented
10. THE CLI SHALL provide clear progress indicators for long-running bulk operations

### Requirement 10: Performance Optimization

**User Story:** As a CLI user working with large datasets, I want efficient bulk operations, so that I can process thousands of records quickly.

#### Acceptance Criteria

1. WHEN bulk operations process large datasets, THE CLI SHALL use pagination to avoid memory exhaustion
2. THE CLI SHALL process bulk operations in configurable batch sizes (default 1000 records)
3. THE CLI SHALL provide a --batch-size flag for bulk operations
4. WHEN fetching all records, THE CLI SHALL use parallel requests for different pages where safe
5. THE CLI SHALL cache swagger documentation to avoid repeated fetches
6. WHEN swagger cache exists and is fresh, THE CLI SHALL use cached data instead of fetching
7. THE CLI SHALL provide a --no-cache flag to bypass swagger cache
8. THE CLI SHALL implement connection pooling in NocoClient for request reuse
9. WHEN processing bulk upserts, THE CLI SHALL minimize redundant list operations
10. THE CLI SHALL provide timing information when --verbose flag is enabled

