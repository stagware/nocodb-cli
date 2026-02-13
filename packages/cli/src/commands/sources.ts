/**
 * Sources command handlers for data source management.
 * 
 * @module commands/sources
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { MetaService } from "../services/meta-service.js";
import { parseJsonInput } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions, addBaseIdOption } from "./helpers.js";
import type { ConfigManager } from "../config/manager.js";
import {
  printResult, handleError, resolveServices, resolveBaseId,
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
  $ nocodb sources get ds_xyz789 --base-id p_abc123
  $ nocodb sources get ds_xyz789                    # uses workspace default base
  $ nocodb sources create -d '{"alias":"my-pg","type":"pg","config":{...}}'
  $ nocodb sources update ds_xyz789 --base-id p_abc123 -d '{"alias":"renamed"}'
  $ nocodb sources delete ds_xyz789 --base-id p_abc123
`);

  // List sources command
  addOutputOptions(
    sourcesCmd
      .command("list")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.listSources(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Get source command
  addOutputOptions(
    addBaseIdOption(
      sourcesCmd
        .command("get")
        .argument("sourceId", "Source id")
    )
  ).action(async (sourceId: string, options: OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
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
        .argument("[baseId]", "Base id or alias"),
      "Source JSON body (e.g. {\"alias\":\"my-pg\",\"type\":\"pg\",\"config\":{...}})"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
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
      addBaseIdOption(
        sourcesCmd
          .command("update")
          .argument("sourceId", "Source id")
      ),
      "Source JSON body (e.g. {\"alias\":\"renamed\"})"
    )
  ).action(async (sourceId: string, options: JsonInputOptions & OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
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
    addBaseIdOption(
      sourcesCmd
        .command("delete")
        .argument("sourceId", "Source id")
    )
  ).action(async (sourceId: string, options: OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.deleteSource(resolvedId!, sourceId);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
