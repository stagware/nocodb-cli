/**
 * Sources command handlers for data source management.
 * 
 * @module commands/sources
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { MetaService } from "../services/meta-service.js";
import { parseJsonInput } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "./helpers.js";
import {
  printResult, handleError, resolveServices,
  type OutputOptions, type JsonInputOptions,
} from "../utils/command-utils.js";

/**
 * Registers sources commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerSourcesCommands(program: Command, container: Container): void {
  const sourcesCmd = program.command("sources").description("Manage base data sources")
    .addHelpText("after", `
Examples:
  $ nocodb sources list p_abc123
  $ nocodb sources get p_abc123 ds_xyz789
  $ nocodb sources create p_abc123 -d '{"alias":"my-pg","type":"pg","config":{...}}'
  $ nocodb sources update p_abc123 ds_xyz789 -d '{"alias":"renamed"}'
  $ nocodb sources delete p_abc123 ds_xyz789
`);

  // List sources command
  addOutputOptions(
    sourcesCmd
      .command("list")
      .argument("baseId", "Base id or alias")
  ).action(async (baseId: string, options: OutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.listSources(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Get source command
  addOutputOptions(
    sourcesCmd
      .command("get")
      .argument("baseId", "Base id or alias")
      .argument("sourceId", "Source id")
  ).action(async (baseId: string, sourceId: string, options: OutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.getSource(resolvedId!, sourceId);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Create source command
  addOutputOptions(
    addJsonInputOptions(
      sourcesCmd
        .command("create")
        .argument("baseId", "Base id or alias"),
      "Source JSON body (e.g. {\"alias\":\"my-pg\",\"type\":\"pg\",\"config\":{...}})"
    )
  ).action(async (baseId: string, options: JsonInputOptions & OutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.createSource(resolvedId!, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Update source command
  addOutputOptions(
    addJsonInputOptions(
      sourcesCmd
        .command("update")
        .argument("baseId", "Base id or alias")
        .argument("sourceId", "Source id"),
      "Source JSON body (e.g. {\"alias\":\"renamed\"})"
    )
  ).action(async (baseId: string, sourceId: string, options: JsonInputOptions & OutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.updateSource(resolvedId!, sourceId, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Delete source command
  addOutputOptions(
    sourcesCmd
      .command("delete")
      .argument("baseId", "Base id or alias")
      .argument("sourceId", "Source id")
  ).action(async (baseId: string, sourceId: string, options: OutputOptions) => {
    try {
      const { client, resolvedId } = resolveServices(container, baseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.deleteSource(resolvedId!, sourceId);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
