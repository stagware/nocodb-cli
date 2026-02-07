/**
 * Sorts command handlers for sort management operations.
 * 
 * @module commands/meta-crud/sorts
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

export function registerSortsCommands(program: Command, container: Container): void {
  const sortsCmd = program.command("sorts").description("Manage view sorts");

  addOutputOptions(sortsCmd.command("list").argument("viewId", "View id")).action(
    async (viewId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.listViewSorts(viewId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(sortsCmd.command("get").argument("sortId", "Sort id")).action(
    async (sortId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getSort(sortId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(sortsCmd.command("create").argument("viewId", "View id"))).action(
    async (viewId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.createViewSort(viewId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(addJsonInputOptions(sortsCmd.command("update").argument("sortId", "Sort id"))).action(
    async (sortId: string, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateSort(sortId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  addOutputOptions(sortsCmd.command("delete").argument("sortId", "Sort id")).action(
    async (sortId: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteSort(sortId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
