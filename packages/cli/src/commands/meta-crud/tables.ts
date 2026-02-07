/**
 * Tables command handlers for table management operations.
 * 
 * @module commands/meta-crud/tables
 */

import { Command } from "commander";
import type { Container } from "../../container.js";
import type { ConfigManager } from "../../config/manager.js";
import type { MetaService } from "../../services/meta-service.js";
import type { NocoClient } from "@nocodb/sdk";
import { parseJsonInput } from "../../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "../helpers.js";
import {
  printResult, handleError,
  type OutputOptions, type JsonInputOptions,
} from "../../utils/command-utils.js";

export function registerTablesCommands(program: Command, container: Container): void {
  const tablesCmd = program.command("tables").description("Manage tables");

  // List tables command
  addOutputOptions(tablesCmd.command("list").argument("baseId", "Base id or alias")).action(
    async (baseId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(baseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.listTables(resolvedBaseId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Get table command
  addOutputOptions(tablesCmd.command("get").argument("tableId", "Table id or alias")).action(
    async (tableId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getTable(resolvedTableId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Create table command
  addOutputOptions(addJsonInputOptions(tablesCmd.command("create").argument("baseId", "Base id or alias"))).action(
    async (baseId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(baseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.createTable(resolvedBaseId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Update table command
  addOutputOptions(addJsonInputOptions(tablesCmd.command("update").argument("tableId", "Table id or alias"))).action(
    async (tableId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateTable(resolvedTableId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Delete table command
  addOutputOptions(tablesCmd.command("delete").argument("tableId", "Table id or alias")).action(
    async (tableId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteTable(resolvedTableId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
