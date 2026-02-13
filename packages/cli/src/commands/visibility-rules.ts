/**
 * Visibility rules command handlers for UI ACL management.
 * 
 * @module commands/visibility-rules
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
 * Registers visibility rules commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerVisibilityRulesCommands(program: Command, container: Container): void {
  const visCmd = program.command("visibility-rules").description("Manage view visibility rules (UI ACL)")
    .addHelpText("after", `
Examples:
  $ nocodb visibility-rules get p_abc123
  $ nocodb visibility-rules set p_abc123 -d '[{"id":"vw_xyz","disabled":{"viewer":true}}]'
`);

  // Get visibility rules
  addOutputOptions(
    visCmd
      .command("get")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.getVisibilityRules(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Set visibility rules
  addOutputOptions(
    addJsonInputOptions(
      visCmd
        .command("set")
        .argument("[baseId]", "Base id or alias"),
      "Visibility rules JSON array"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.setVisibilityRules(resolvedId!, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
