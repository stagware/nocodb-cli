/**
 * Shared Base command handlers for managing public base sharing.
 * 
 * @module commands/shared-base
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { MetaService } from "../services/meta-service.js";
import { parseJsonInput } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "./helpers.js";
import {
  printResult, handleError, resolveServices, resolveBaseId,
  type OutputOptions, type JsonInputOptions,
} from "../utils/command-utils.js";

/**
 * Registers shared-base commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerSharedBaseCommands(program: Command, container: Container): void {
  const sharedBaseCmd = program.command("shared-base").description("Manage shared base (public base link)")
    .addHelpText("after", `
Examples:
  $ nocodb shared-base get p_abc123
  $ nocodb shared-base create p_abc123
  $ nocodb shared-base create p_abc123 -d '{"roles":"viewer","password":"secret"}'
  $ nocodb shared-base update p_abc123 -d '{"roles":"editor"}'
  $ nocodb shared-base delete p_abc123
`);

  // Get shared base command
  addOutputOptions(
    sharedBaseCmd
      .command("get")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.getSharedBase(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Create shared base command
  addOutputOptions(
    addJsonInputOptions(
      sharedBaseCmd
        .command("create")
        .argument("[baseId]", "Base id or alias"),
      "Optional shared base JSON body (e.g. {\"roles\":\"viewer\",\"password\":\"secret\"})"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      let body: any;
      if (options.data || options.dataFile) {
        body = await parseJsonInput(options.data, options.dataFile);
      }
      const result = await metaService.createSharedBase(resolvedId!, body);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Update shared base command
  addOutputOptions(
    addJsonInputOptions(
      sharedBaseCmd
        .command("update")
        .argument("[baseId]", "Base id or alias"),
      "Shared base JSON body (e.g. {\"roles\":\"editor\"})"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.updateSharedBase(resolvedId!, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Delete shared base command
  addOutputOptions(
    sharedBaseCmd
      .command("delete")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.deleteSharedBase(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
