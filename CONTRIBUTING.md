# Contributing to nocodb-cli

Thanks for your interest in contributing! This guide will help you get set up and productive quickly.

## Prerequisites

- **Node.js** >= 18
- **npm** >= 11
- **Git**

## Repository Structure

This is a monorepo with two packages:

```
packages/
  sdk/    → @stagware/nocodb-sdk  (TypeScript SDK for NocoDB v2 API)
  cli/    → @stagware/nocodb-cli  (Command-line interface)
```

The SDK is a dependency of the CLI. npm workspaces handle local resolution automatically.

## Getting Started

```sh
# Clone the repo
git clone https://github.com/stagware/nocodb-cli.git
cd nocodb-cli

# Install all dependencies (workspaces resolve automatically)
npm install

# Build both packages (SDK must build first)
npm run build

# Run all tests
npm test
```

## Development Workflow

### Building

```sh
npm run build                          # Build SDK then CLI
npm --prefix packages/sdk run build    # Build SDK only
npm --prefix packages/cli run build    # Build CLI only (requires SDK built first)
```

### Testing

```sh
npm test                               # Run all tests (SDK + CLI)
npm --prefix packages/sdk run test     # SDK tests only (249 tests)
npm --prefix packages/cli run test     # CLI tests only (610 tests)
```

### Running the CLI locally

```sh
# Via tsx (no build needed)
npm run dev -- bases list

# Via built output
npm run build
node packages/cli/dist/index.js bases list
```

### E2E Tests

The E2E suite runs against a live NocoDB instance:

```sh
export NOCO_BASE_URL=https://your-nocodb-instance.com
export NOCO_TOKEN=your-api-token
export NOCO_BASE_ID=your-base-id
npm run e2e
```

Set `NOCO_KEEP=1` to preserve test tables after the run.

## Project Architecture

### SDK (`packages/sdk/src/`)

- **`index.ts`** — `NocoClient` (HTTP client), `MetaApi` (metadata CRUD), `DataApi` (record/link operations)
- **`types/entities.ts`** — All entity types (`Base`, `Table`, `View`, `Column`, etc.)
- **`types/responses.ts`** — Response wrappers (`ListResponse<T>`, `PageInfo`, bulk responses)
- **`errors.ts`** — Typed error classes (`AuthenticationError`, `NotFoundError`, etc.)

### CLI (`packages/cli/src/`)

- **`index.ts`** — Entry point, Commander program setup, global flags
- **`commands/`** — One file per command group (rows, bases, tables, views, etc.)
- **`services/`** — Business logic layer (`MetaService`, `RowService`, `LinkService`, etc.)
- **`config/`** — Workspace and configuration management
- **`utils/`** — Shared utilities (parsing, formatting, error handling)

### Key Patterns

- **Dependency injection** — Commands receive a `Container` that provides services
- **Service layer** — Commands delegate to services, services delegate to SDK
- **AJV validation** — Request bodies are validated against Swagger schemas
- **Output formatting** — All commands support `--pretty`, `--format`, `--select`

## Making Changes

### Adding a new SDK method

1. Add the method to `MetaApi` or `DataApi` in `packages/sdk/src/index.ts`
2. Add/update types in `packages/sdk/src/types/entities.ts` if needed
3. Export new types from `packages/sdk/src/index.ts`
4. Add tests in `packages/sdk/test/`

### Adding a new CLI command

1. Add a service method in the appropriate `packages/cli/src/services/*.ts` file
2. Create or update a command file in `packages/cli/src/commands/`
3. Register the command in `packages/cli/src/index.ts`
4. Add tests in `packages/cli/test/`
5. Update the README with usage examples

### Code Style

- **TypeScript** throughout — no `any` unless absolutely necessary
- **ESM only** — use `.js` extensions in imports (TypeScript resolves them)
- **Preserve existing comments** — don't add or remove comments unless specifically needed
- **JSDoc** on public APIs — SDK methods have full JSDoc with `@param`, `@returns`, `@throws`, `@example`
- **No emojis** in code unless explicitly requested

## Testing Guidelines

- **Unit tests** for services and utilities — mock the `NocoClient`
- **E2E tests** for commands — spawn the CLI as a child process against a mock HTTP server
- **Property-based tests** for parsing and formatting utilities
- Tests use **Vitest** — run with `vitest run` or `vitest` (watch mode)

### Test file naming

- `packages/sdk/test/*.test.ts` — SDK tests
- `packages/cli/test/*.test.ts` — CLI tests
- `*-e2e.test.ts` suffix for end-to-end tests
- `*.test.ts` for unit tests

## Pull Request Process

1. **Fork** the repo and create a feature branch from `main`
2. Make your changes following the patterns above
3. Ensure `npm run build && npm test` passes with no failures
4. Write or update tests for your changes
5. Update documentation (README, help text) if adding user-facing features
6. Open a PR with a clear description of what and why

## Reporting Issues

- Use [GitHub Issues](https://github.com/stagware/nocodb-cli/issues)
- Include your Node.js version, NocoDB version, and OS
- For bugs, include the command you ran and the error output
- For feature requests, describe the use case

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
