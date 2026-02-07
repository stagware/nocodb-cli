/**
 * Me command handler for verifying authentication.
 * 
 * @module commands/me
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import { addOutputOptions } from "./helpers.js";
import { printResult, handleError, resolveServices, type OutputOptions } from "../utils/command-utils.js";

/**
 * Registers the `me` command with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerMeCommand(program: Command, container: Container): void {
  addOutputOptions(
    program.command("me").description("Show current authenticated user (auth sanity check)")
  ).action(async (options: OutputOptions) => {
    try {
      const { client } = resolveServices(container);
      const result = await client.request("GET", "/api/v1/auth/user/me");
      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
