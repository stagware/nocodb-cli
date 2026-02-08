/**
 * Duplicate command handlers for base, source, and table duplication.
 * 
 * @module commands/duplicate
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { MetaService } from "../services/meta-service.js";
import { addOutputOptions } from "./helpers.js";
import { validateEntityId } from "../utils/parsing.js";
import {
  printResult, handleError, resolveServices,
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
  $ nocodb duplicate source p_abc123 ds_xyz789
  $ nocodb duplicate table p_abc123 tbl_xyz --exclude-views --exclude-hooks
`);

  // Duplicate base
  addOutputOptions(
    addDuplicateOptions(
      dupCmd
        .command("base")
        .argument("baseId", "Base id or alias")
    )
  ).action(async (baseId: string, options: DuplicateOutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
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
      dupCmd
        .command("source")
        .argument("baseId", "Base id or alias")
        .argument("sourceId", "Source id")
    )
  ).action(async (baseId: string, sourceId: string, options: DuplicateOutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
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
      dupCmd
        .command("table")
        .argument("baseId", "Base id or alias")
        .argument("tableId", "Table id or alias")
    )
  ).action(async (baseId: string, tableId: string, options: DuplicateOutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      // Resolve tableId alias too (validate first, consistent with resolveServices)
      const configManager = container.get<any>("configManager");
      const validatedTableId = validateEntityId(tableId, "table");
      const resolvedTableId = configManager.resolveAlias(validatedTableId).id;

      const result = await metaService.duplicateTable(resolvedId!, resolvedTableId, buildOptions(options));
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
