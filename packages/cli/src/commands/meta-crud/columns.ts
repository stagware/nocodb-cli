/**
 * Columns command handlers for column management operations.
 * 
 * @module commands/meta-crud/columns
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

export function registerColumnsCommands(program: Command, container: Container): void {
  const columnsCmd = program.command("columns").description("Manage table columns");

  addOutputOptions(columnsCmd.command("list").argument("tableId", "Table id")).action(
    async (tableId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.listColumns(tableId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(columnsCmd.command("get").argument("columnId", "Column id")).action(
    async (columnId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getColumn(columnId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(columnsCmd.command("create").argument("tableId", "Table id"))).action(
    async (tableId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.createColumn(tableId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(columnsCmd.command("update").argument("columnId", "Column id"))).action(
    async (columnId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateColumn(columnId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(columnsCmd.command("delete").argument("columnId", "Column id")).action(
    async (columnId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteColumn(columnId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
