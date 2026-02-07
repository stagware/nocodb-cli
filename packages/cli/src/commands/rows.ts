/**
 * Row command handlers for table row CRUD operations.
 * 
 * This module provides CLI commands for managing table rows, including:
 * - Single row operations (list, read, create, update, delete)
 * - Bulk operations (bulk-create, bulk-update, bulk-delete)
 * - Upsert operations (upsert, bulk-upsert)
 * 
 * All commands use the dependency injection container to access services
 * and follow the pattern: parse arguments → call service → format output
 * 
 * @module commands/rows
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { RowService } from "../services/row-service.js";
import type { NocoClient } from "@nocodb/sdk";
import { parseJsonInput, parseKeyValue, getBaseIdFromArgv } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "./helpers.js";
import {
  printResult, handleError, collect, parseQuery,
  type OutputOptions, type JsonInputOptions,
} from "../utils/command-utils.js";

/**
 * Registers row commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerRowsCommands(program: Command, container: Container): void {
  const rowsCmd = program.command("rows").description("Table row CRUD (base-scoped)");

  // List rows command
  addOutputOptions(
    rowsCmd
      .command("list")
      .argument("tableId", "Table id or alias")
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
      .option("-a, --all", "Fetch all pages (auto-paginate)")
  ).action(async (tableId: string, options: { query: string[]; all?: boolean } & OutputOptions) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse query parameters
      const query = parseQuery(options.query || []);
      const queryOrUndefined = Object.keys(query).length ? query : undefined;

      // Call service — use listAll when --all flag is set
      const result = options.all
        ? await rowService.listAll(resolvedTableId, queryOrUndefined)
        : await rowService.list(resolvedTableId, queryOrUndefined);

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Read single row command
  addOutputOptions(
    rowsCmd
      .command("read")
      .argument("tableId", "Table id or alias")
      .argument("recordId", "Record id")
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
  ).action(async (
    tableId: string,
    recordId: string,
    options: { query: string[] } & OutputOptions
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Create client
      const client = createClient(ws, settings) as NocoClient;

      // Parse query parameters
      const query = parseQuery(options.query || []);

      // Make request directly (read is not in RowService)
      const result = await client.request(
        "GET",
        `/api/v2/tables/${resolvedTableId}/records/${recordId}`,
        { query: Object.keys(query).length ? query : undefined }
      );

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Create row command
  addOutputOptions(
    addJsonInputOptions(rowsCmd.command("create").argument("tableId", "Table id or alias"))
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);

      // Call service
      const result = await rowService.create(resolvedTableId, body as any, baseId);

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Bulk create rows command
  addOutputOptions(
    addJsonInputOptions(
      rowsCmd.command("bulk-create").argument("tableId", "Table id or alias"),
      "Request JSON body (array of row objects)"
    )
      .option("--fail-fast", "Stop on first error")
      .option("--batch-size <number>", "Batch size for processing (default: 1000)", parseInt)
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions & { failFast?: boolean; batchSize?: number }) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);
      if (!Array.isArray(body)) {
        throw new Error("bulk-create expects a JSON array of row objects");
      }

      // Call service
      const result = await rowService.bulkCreate(resolvedTableId, body, baseId, { 
        failFast: options.failFast,
        batchSize: options.batchSize,
      });

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Update row command
  addOutputOptions(
    addJsonInputOptions(rowsCmd.command("update").argument("tableId", "Table id or alias"))
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);

      // Call service
      const result = await rowService.update(resolvedTableId, body as any, baseId);

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Bulk update rows command
  addOutputOptions(
    addJsonInputOptions(
      rowsCmd.command("bulk-update").argument("tableId", "Table id or alias"),
      "Request JSON body (array of row objects with Id)"
    )
      .option("--fail-fast", "Stop on first error")
      .option("--batch-size <number>", "Batch size for processing (default: 1000)", parseInt)
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions & { failFast?: boolean; batchSize?: number }) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);
      if (!Array.isArray(body)) {
        throw new Error("bulk-update expects a JSON array of row objects");
      }

      // Call service
      const result = await rowService.bulkUpdate(resolvedTableId, body, baseId, { 
        failFast: options.failFast,
        batchSize: options.batchSize,
      });

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Upsert row command
  addOutputOptions(
    addJsonInputOptions(rowsCmd.command("upsert").argument("tableId", "Table id or alias"))
      .requiredOption("--match <field=value>", "Field/value matcher used to find an existing row")
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
      .option("--create-only", "Only create, fail if a matching row exists")
      .option("--update-only", "Only update, fail if no matching row exists")
  ).action(async (
    tableId: string,
    options: JsonInputOptions & OutputOptions & {
      match: string;
      query: string[];
      createOnly?: boolean;
      updateOnly?: boolean;
    }
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse match field and value
      const [matchField, matchValue] = parseKeyValue(options.match);

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("upsert expects a JSON object body");
      }

      // Parse query parameters
      const query = parseQuery(options.query || []);

      // Call service
      const result = await rowService.upsert(
        resolvedTableId,
        body as any,
        matchField,
        matchValue,
        baseId,
        {
          createOnly: options.createOnly,
          updateOnly: options.updateOnly,
          query: Object.keys(query).length ? query : undefined,
        }
      );

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Bulk upsert rows command
  addOutputOptions(
    addJsonInputOptions(
      rowsCmd
        .command("bulk-upsert")
        .argument("tableId", "Table id or alias")
        .requiredOption("--match <field>", "Field name used to match existing rows")
        .option("-q, --query <key=value>", "Query string parameter", collect, [])
        .option("--create-only", "Only create, fail if a matching row exists")
        .option("--update-only", "Only update, fail if no matching row exists"),
      "Request JSON body (array of row objects)"
    )
  ).action(async (
    tableId: string,
    options: JsonInputOptions & OutputOptions & {
      match: string;
      query: string[];
      createOnly?: boolean;
      updateOnly?: boolean;
    }
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);
      if (!Array.isArray(body)) {
        throw new Error("bulk-upsert expects a JSON array of row objects");
      }

      // Parse query parameters
      const query = parseQuery(options.query || []);

      // Call service
      const result = await rowService.bulkUpsert(
        resolvedTableId,
        body,
        options.match,
        baseId,
        {
          createOnly: options.createOnly,
          updateOnly: options.updateOnly,
          query: Object.keys(query).length ? query : undefined,
        }
      );

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Delete row command
  addOutputOptions(
    addJsonInputOptions(rowsCmd.command("delete").argument("tableId", "Table id or alias"))
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);

      // Call service
      const result = await rowService.delete(resolvedTableId, body as any, baseId);

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Bulk delete rows command
  addOutputOptions(
    addJsonInputOptions(
      rowsCmd.command("bulk-delete").argument("tableId", "Table id or alias"),
      "Request JSON body (array of row identifiers)"
    )
      .option("--fail-fast", "Stop on first error")
      .option("--batch-size <number>", "Batch size for processing (default: 1000)", parseInt)
  ).action(async (tableId: string, options: JsonInputOptions & OutputOptions & { failFast?: boolean; batchSize?: number }) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const rowServiceFactory = container.get<Function>("rowService");

      // Resolve alias and get workspace context
      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      
      // Get effective config
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      // Get baseId for swagger validation
      const baseId = ws?.baseId || getBaseIdFromArgv(process.argv);
      if (!baseId) {
        throw new Error("Base ID not configured. Use --base flag or configure a workspace.");
      }

      // Create client and service
      const client = createClient(ws, settings) as NocoClient;
      const rowService = rowServiceFactory(client) as RowService;

      // Parse input data
      const body = await parseJsonInput(options.data, options.dataFile);
      if (!Array.isArray(body)) {
        throw new Error("bulk-delete expects a JSON array body");
      }

      // Call service
      const result = await rowService.bulkDelete(resolvedTableId, body, baseId, { 
        failFast: options.failFast,
        batchSize: options.batchSize,
      });

      // Format output
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
