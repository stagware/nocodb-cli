/**
 * Duplicate command handlers for base, source, and table duplication.
 * 
 * @module commands/duplicate
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { MetaService } from "../services/meta-service.js";
import { addOutputOptions, addBaseIdOption } from "./helpers.js";
import { validateEntityId } from "../utils/parsing.js";
import {
  printResult, handleError, resolveServices, resolveBaseId,
  type OutputOptions,
} from "../utils/command-utils.js";

interface DuplicateOutputOptions extends OutputOptions {
  excludeData?: boolean;
  excludeViews?: boolean;
  excludeHooks?: boolean;
}

function addDuplicateOptions<T extends Command>(cmd: T): T {
  return cmd
    .option("--exclude-data", "Exclude row data from the duplicate")
    .option("--exclude-views", "Exclude views from the duplicate")
    .option("--exclude-hooks", "Exclude hooks/webhooks from the duplicate") as T;
}

function buildOptions(opts: DuplicateOutputOptions) {
  const options: Record<string, boolean> = {};
  if (opts.excludeData) options.excludeData = true;
  if (opts.excludeViews) options.excludeViews = true;
  if (opts.excludeHooks) options.excludeHooks = true;
  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Registers duplicate commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerDuplicateCommands(program: Command, container: Container): void {
  const dupCmd = program.command("duplicate").description("Duplicate bases, sources, and tables")
    .addHelpText("after", `
Examples:
  $ nocodb duplicate base p_abc123
  $ nocodb duplicate base p_abc123 --exclude-data
  $ nocodb duplicate source ds_xyz789 --base-id p_abc123
  $ nocodb duplicate source ds_xyz789              # uses workspace default base
  $ nocodb duplicate table tbl_xyz --base-id p_abc123 --exclude-views --exclude-hooks
  $ nocodb duplicate table tbl_xyz                 # uses workspace default base
`);

  // Duplicate base
  addOutputOptions(
    addDuplicateOptions(
      dupCmd
        .command("base")
        .argument("[baseId]", "Base id or alias")
    )
  ).action(async (baseId: string | undefined, options: DuplicateOutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.duplicateBase(resolvedId!, buildOptions(options));
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Duplicate source
  addOutputOptions(
    addDuplicateOptions(
      addBaseIdOption(
        dupCmd
          .command("source")
          .argument("sourceId", "Source id")
      )
    )
  ).action(async (sourceId: string, options: DuplicateOutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.duplicateSource(resolvedId!, sourceId, buildOptions(options));
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Duplicate table
  addOutputOptions(
    addDuplicateOptions(
      addBaseIdOption(
        dupCmd
          .command("table")
          .argument("tableId", "Table id or alias")
      )
    )
  ).action(async (tableId: string, options: DuplicateOutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      // Resolve tableId alias too (validate first, consistent with resolveServices)
      const configManager = container.get<ConfigManager>("configManager");
      const validatedTableId = validateEntityId(tableId, "table");
      const resolvedTableId = configManager.resolveAlias(validatedTableId).id;

      const result = await metaService.duplicateTable(resolvedId!, resolvedTableId, buildOptions(options));
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
