# Technology Stack

## Language & Runtime

- **TypeScript 5.6+**: Strict mode enabled
- **Node.js**: ES2022 target, ESNext modules
- **Module System**: ESM (ES Modules) only

## Build System

- **tsup**: Fast TypeScript bundler for both packages
- **npm workspaces**: Monorepo with two packages (`@nocodb/sdk` and `@nocodb/cli`)
- **Package Manager**: npm 10

## Key Dependencies

### SDK (`packages/sdk`)
- `ofetch`: HTTP client for API requests

### CLI (`packages/cli`)
- `commander`: CLI framework for command parsing
- `conf`: Configuration management
- `ajv`: JSON schema validation
- `@nocodb/sdk`: Internal SDK dependency

## Testing

- **vitest**: Test runner for both packages
- Test files located in `test/` directories with `.test.ts` suffix

## Common Commands

### Build
```sh
npm run build          # Build both SDK and CLI
npm run build --prefix packages/sdk   # Build SDK only
npm run build --prefix packages/cli   # Build CLI only
```

### Development
```sh
npm run dev            # Run CLI in development mode with tsx
```

### Testing
```sh
npm test               # Run all tests
npm --prefix packages/sdk run test    # SDK tests only
npm --prefix packages/cli run test    # CLI tests only
```

### E2E Testing
```sh
npm run e2e            # Run end-to-end CLI test script
```

## TypeScript Configuration

- **Base config**: `tsconfig.base.json` with strict mode
- **Module Resolution**: Bundler mode
- **Output**: Declaration files (`.d.ts`) and source maps generated
- Each package extends base config with specific `outDir` and `rootDir`

## Build Output

- SDK: `packages/sdk/dist/` (includes `.d.ts` types)
- CLI: `packages/cli/dist/` (executable with shebang)
- CLI binary: `nocodb` command
