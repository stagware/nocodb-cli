/**
 * Tokens command handlers for API token management.
 * 
 * @module commands/tokens
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { MetaService } from "../services/meta-service.js";
import { parseJsonInput } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions, addBaseIdOption } from "./helpers.js";
import {
  printResult, handleError, resolveServices, resolveBaseId,
  type OutputOptions, type JsonInputOptions,
} from "../utils/command-utils.js";

/**
 * Registers tokens commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerTokensCommands(program: Command, container: Container): void {
  const tokensCmd = program.command("tokens").description("Manage API tokens (base-scoped)")
    .addHelpText("after", `
Examples:
  $ nocodb tokens list p_abc123
  $ nocodb tokens create p_abc123 -d '{"description":"CI/CD token"}'
  $ nocodb tokens delete tok_xyz789 --base-id p_abc123
  $ nocodb tokens delete tok_xyz789              # uses workspace default base
`);

  // List tokens command
  addOutputOptions(
    tokensCmd
      .command("list")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.listTokens(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Create token command
  addOutputOptions(
    addJsonInputOptions(
      tokensCmd
        .command("create")
        .argument("[baseId]", "Base id or alias"),
      "Token JSON body (e.g. {\"description\":\"my token\"})"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.createToken(resolvedId!, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Delete token command
  addOutputOptions(
    addBaseIdOption(
      tokensCmd
        .command("delete")
        .argument("tokenId", "Token ID to delete")
    )
  ).action(async (tokenId: string, options: OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.deleteToken(resolvedId!, tokenId);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
