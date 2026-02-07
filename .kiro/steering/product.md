# Product Overview

nocodb-cli is a Node.js SDK and CLI tool for interacting with NocoDB v2 APIs. It provides programmatic access to NocoDB instances through both a TypeScript SDK and a command-line interface.

## Core Features

- **Multi-workspace support**: Manage multiple NocoDB instances with distinct URLs, tokens, and base IDs
- **Alias system**: Use friendly names instead of UUIDs, namespaced by workspace
- **Full CRUD operations**: Complete coverage of bases, tables, views, columns, filters, sorts, and rows
- **Bulk operations**: Efficient batch create, update, upsert, and delete for rows
- **Dynamic API discovery**: Swagger-based endpoint discovery and invocation
- **Storage operations**: File upload support
- **Configurable retry logic**: Timeout and retry behavior with customizable settings

## Target Users

Developers and automation engineers who need to:
- Automate NocoDB workflows
- Integrate NocoDB with other systems
- Manage multiple NocoDB instances
- Perform bulk data operations
- Script database operations
