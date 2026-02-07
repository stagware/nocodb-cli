/**
 * Filters command handlers for filter management operations.
 * 
 * @module commands/meta-crud/filters
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

export function registerFiltersCommands(program: Command, container: Container): void {
  const filtersCmd = program.command("filters").description("Manage view filters");

  addOutputOptions(filtersCmd.command("list").argument("viewId", "View id")).action(
    async (viewId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.listViewFilters(viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(filtersCmd.command("get").argument("filterId", "Filter id")).action(
    async (filterId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getFilter(filterId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(filtersCmd.command("create").argument("viewId", "View id"))).action(
    async (viewId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.createViewFilter(viewId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(filtersCmd.command("update").argument("filterId", "Filter id"))).action(
    async (filterId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateFilter(filterId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(filtersCmd.command("delete").argument("filterId", "Filter id")).action(
    async (filterId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteFilter(filterId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
