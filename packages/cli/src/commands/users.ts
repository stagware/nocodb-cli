/**
 * Users command handlers for base collaborator management.
 * 
 * @module commands/users
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
 * Registers users commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerUsersCommands(program: Command, container: Container): void {
  const usersCmd = program.command("users").description("Manage base collaborators")
    .addHelpText("after", `
Examples:
  $ nocodb users list p_abc123
  $ nocodb users invite p_abc123 -d '{"email":"user@example.com","roles":"editor"}'
  $ nocodb users update usr_xyz --base-id p_abc123 -d '{"roles":"viewer"}'
  $ nocodb users remove usr_xyz --base-id p_abc123
  $ nocodb users remove usr_xyz                    # uses workspace default base
`);

  // List users command
  addOutputOptions(
    usersCmd
      .command("list")
      .argument("[baseId]", "Base id or alias")
  ).action(async (baseId: string | undefined, options: OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.listBaseUsers(resolvedId!);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Invite user command
  addOutputOptions(
    addJsonInputOptions(
      usersCmd
        .command("invite")
        .argument("[baseId]", "Base id or alias"),
      "User JSON body (e.g. {\"email\":\"user@example.com\",\"roles\":\"editor\"})"
    )
  ).action(async (baseId: string | undefined, options: JsonInputOptions & OutputOptions) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.inviteBaseUser(resolvedId!, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Update user command
  addOutputOptions(
    addJsonInputOptions(
      addBaseIdOption(
        usersCmd
          .command("update")
          .argument("userId", "User id")
      ),
      "User JSON body (e.g. {\"roles\":\"viewer\"})"
    )
  ).action(async (userId: string, options: JsonInputOptions & OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await metaService.updateBaseUser(resolvedId!, userId, body as any);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Remove user command
  addOutputOptions(
    addBaseIdOption(
      usersCmd
        .command("remove")
        .argument("userId", "User id")
    )
  ).action(async (userId: string, options: OutputOptions & { baseId?: string }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, options.baseId);
      const { client, resolvedId } = resolveServices(container, effectiveBaseId);
      const metaService = container.get<Function>("metaService")(client) as MetaService;

      const result = await metaService.removeBaseUser(resolvedId!, userId);
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
