/**
 * Bases command handlers for base management operations.
 * 
 * This module provides CLI commands for managing NocoDB bases, including:
 * - List all bases
 * - Get base details
 * - Get base info
 * - Create a new base
 * - Update a base
 * - Delete a base
 * 
 * @module commands/meta-crud/bases
 */

import { Command } from "commander";
import type { Container } from "../../container.js";
import type { ConfigManager } from "../../config/manager.js";
import type { MetaService } from "../../services/meta-service.js";
import type { NocoClient } from "@stagware/nocodb-sdk";
import { parseJsonInput } from "../../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "../helpers.js";
import {
  printResult, handleError, resolveBaseId,
  type OutputOptions, type JsonInputOptions,
} from "../../utils/command-utils.js";

/**
 * Registers bases commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerBasesCommands(program: Command, container: Container): void {
  const basesCmd = program.command("bases").description("Manage bases")
    .addHelpText("after", `
Examples:
  $ nocodb bases list
  $ nocodb bases get p_abc123
  $ nocodb bases info p_abc123
  $ nocodb bases create -d '{"title":"My Base"}'
  $ nocodb bases update p_abc123 -d '{"title":"Renamed"}'
  $ nocodb bases delete p_abc123
`);

  // List bases command
  addOutputOptions(basesCmd.command("list")).action(async (options: OutputOptions) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const metaServiceFactory = container.get<Function>("metaService");

      const { workspace, settings } = configManager.getEffectiveConfig({});
      const client = createClient(workspace, settings) as NocoClient;
      const metaService = metaServiceFactory(client) as MetaService;

      const result = await metaService.listBases();
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Get base command
  addOutputOptions(basesCmd.command("get").argument("[baseId]", "Base id or alias")).action(
    async (baseId: string | undefined, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const effectiveBaseId = resolveBaseId(container, baseId);
        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(effectiveBaseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getBase(resolvedBaseId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Get base info command
  addOutputOptions(basesCmd.command("info").argument("[baseId]", "Base id or alias")).action(
    async (baseId: string | undefined, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const effectiveBaseId = resolveBaseId(container, baseId);
        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(effectiveBaseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.getBaseInfo(resolvedBaseId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Create base command
  addOutputOptions(addJsonInputOptions(basesCmd.command("create"))).action(
    async (options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.createBase(body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Update base command
  addOutputOptions(addJsonInputOptions(basesCmd.command("update").argument("[baseId]", "Base id or alias"))).action(
    async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const effectiveBaseId = resolveBaseId(container, baseId);
        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(effectiveBaseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const body = await parseJsonInput(options.data, options.dataFile);
        const result = await metaService.updateBase(resolvedBaseId, body);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );

  // Delete base command
  addOutputOptions(basesCmd.command("delete").argument("[baseId]", "Base id or alias")).action(
    async (baseId: string | undefined, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const metaServiceFactory = container.get<Function>("metaService");

        const effectiveBaseId = resolveBaseId(container, baseId);
        const { id: resolvedBaseId, workspace } = configManager.resolveAlias(effectiveBaseId);
        const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
        const ws = workspace || effectiveWorkspace;

        const client = createClient(ws, settings) as NocoClient;
        const metaService = metaServiceFactory(client) as MetaService;

        const result = await metaService.deleteBase(resolvedBaseId);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
