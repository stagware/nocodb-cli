/**
 * Data import/export command handlers.
 * 
 * Provides CLI commands for exporting table rows to CSV/JSON files
 * and importing rows from CSV/JSON files into tables.
 * 
 * @module commands/data-io
 */

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { RowService } from "../services/row-service.js";
import type { NocoClient, Row, ListResponse } from "@nocodb/sdk";
import { handleError, collect, parseQuery } from "../utils/command-utils.js";
import { formatCsv, formatJson } from "../utils/formatting.js";
import { parseCsv, getBaseIdFromArgv } from "../utils/parsing.js";

/**
 * Registers data import/export commands with the CLI program.
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerDataIoCommands(program: Command, container: Container): void {
  const dataCmd = program.command("data").description("Import and export table data");

  // --- export ---
  dataCmd
    .command("export")
    .argument("tableId", "Table id or alias")
    .option("-o, --out <path>", "Output file path (writes to stdout if omitted)")
    .option("--format <type>", "Output format: csv or json (default: inferred from --out extension, else json)")
    .option("-q, --query <key=value>", "Query string parameter (where, sort, fields, etc.)", collect, [])
    .description("Export all rows from a table to CSV or JSON")
    .action(async (tableId: string, options: { out?: string; format?: string; query: string[] }) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const rowServiceFactory = container.get<Function>("rowService");

        // Resolve alias
        const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);

        // Get effective config
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        // Create client and service
        const client = createClient(ws, settings) as NocoClient;
        const rowService = rowServiceFactory(client) as RowService;

        // Parse optional query filters
        const query = parseQuery(options.query || []);
        const queryOrUndefined = Object.keys(query).length ? query : undefined;

        // Fetch all rows
        const result = await rowService.listAll(resolvedTableId, queryOrUndefined);

        // Determine format
        const format = resolveFormat(options.format, options.out, "json");

        // Format output
        const output = format === "csv"
          ? formatCsv(result.list)
          : formatJson(result.list, true);

        // Write to file or stdout
        if (options.out) {
          const resolved = path.resolve(options.out);
          validateFilePath(resolved, options.out);
          await fs.promises.writeFile(resolved, output, "utf8");
          console.log(`Exported ${result.list.length} rows to ${resolved}`);
        } else {
          console.log(output);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // --- import ---
  dataCmd
    .command("import")
    .argument("tableId", "Table id or alias")
    .argument("filePath", "Path to CSV or JSON file")
    .option("--format <type>", "Input format: csv or json (default: inferred from file extension)")
    .option("--match <field>", "Upsert: match on this field to update existing rows, create new ones")
    .option("--create-only", "With --match: only create, fail if a matching row exists")
    .option("--update-only", "With --match: only update, fail if no matching row exists")
    .description("Import rows from a CSV or JSON file into a table (supports --match for upsert)")
    .action(async (tableId: string, filePath: string, options: { format?: string; match?: string; createOnly?: boolean; updateOnly?: boolean }) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const rowServiceFactory = container.get<Function>("rowService");

        // Resolve alias
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

        // Read file
        const resolved = path.resolve(filePath);
        validateFilePath(resolved, filePath);
        const raw = await fs.promises.readFile(resolved, "utf8");

        // Determine format
        const format = resolveFormat(options.format, filePath, "json");

        // Parse rows
        let rows: Row[];
        if (format === "csv") {
          rows = parseCsv(raw) as Row[];
        } else {
          const parsed = JSON.parse(raw);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        }

        if (rows.length === 0) {
          console.log("No rows to import.");
          return;
        }

        if (options.match) {
          // Upsert mode: use RowService.bulkUpsert for swagger validation
          const result = await rowService.bulkUpsert(resolvedTableId, rows, options.match, baseId, {
            createOnly: options.createOnly,
            updateOnly: options.updateOnly,
          });
          const createdCount = result.created?.created ?? 0;
          const updatedCount = result.updated?.updated ?? 0;
          console.log(`Imported into ${resolvedTableId}: ${createdCount} created, ${updatedCount} updated`);
        } else {
          // Plain bulk create via RowService for swagger validation
          const result = await rowService.bulkCreate(resolvedTableId, rows, baseId, { batchSize: 1000 });
          console.log(`Imported ${result.created} rows into ${resolvedTableId}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}

/**
 * Resolves the output/input format from explicit option, file extension, or default.
 */
function resolveFormat(explicit?: string, filePath?: string, fallback = "json"): string {
  if (explicit) return explicit.toLowerCase();
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".csv") return "csv";
    if (ext === ".json") return "json";
  }
  return fallback;
}

/**
 * Validates a file path to prevent path traversal.
 */
function validateFilePath(resolved: string, original: string): void {
  if (resolved !== path.normalize(resolved) || original.includes("..")) {
    throw new Error(`Invalid file path: '${original}'. Path traversal is not allowed.`);
  }
}
