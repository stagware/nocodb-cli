/**
 * Views command handlers for view management operations.
 * 
 * @module commands/meta-crud/views
 */

import { Command } from "commander";
import type { Container } from "../../container.js";
import type { ConfigManager } from "../../config/manager.js";
import type { MetaService } from "../../services/meta-service.js";
import type { NocoClient, ViewType } from "@nocodb/sdk";
import { parseJsonInput } from "../../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "../helpers.js";
import {
  printResult, handleError,
  type OutputOptions, type JsonInputOptions,
} from "../../utils/command-utils.js";

export function registerViewsCommands(program: Command, container: Container): void {
  const viewsCmd = program.command("views").description("Manage views");

  // List views command
  addOutputOptions(viewsCmd.command("list").argument("tableId", "Table id")).action(
    async (tableId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.listViews(tableId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Get view command
  addOutputOptions(viewsCmd.command("get").argument("tableId", "Table id").argument("viewId", "View id")).action(
    async (tableId: string, viewId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getView(tableId, viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Create view command
  addOutputOptions(addJsonInputOptions(
    viewsCmd.command("create").argument("tableId", "Table id")
      .option("--type <type>", "View type: grid, form, gallery, kanban, calendar (default: grid)")
  )).action(
    async (tableId: string, options: JsonInputOptions & OutputOptions & { type?: string }) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const viewType = (options.type || 'grid') as ViewType;
        const result = await metaService.createView(tableId, body, viewType);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Update view command
  addOutputOptions(addJsonInputOptions(viewsCmd.command("update").argument("viewId", "View id"))).action(
    async (viewId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateView(viewId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Delete view command
  addOutputOptions(viewsCmd.command("delete").argument("viewId", "View id")).action(
    async (viewId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteView(viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
