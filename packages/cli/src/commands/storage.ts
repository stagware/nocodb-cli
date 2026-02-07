/**
 * Storage command handlers for file storage operations.
 * 
 * @module commands/storage
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { StorageService } from "../services/storage-service.js";
import type { NocoClient } from "@nocodb/sdk";
import { addOutputOptions } from "./helpers.js";
import { printResult, handleError, type OutputOptions } from "../utils/command-utils.js";

/**
 * Registers storage commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerStorageCommands(program: Command, container: Container): void {
  const storageCmd = program.command("storage").description("File storage operations");

  // Upload file command
  addOutputOptions(storageCmd.command("upload").argument("filePath", "Path to the file to upload")).action(
    async (filePath: string, options: OutputOptions) => {
      try {
        const configManager = container.get<ConfigManager>("configManager");
        const createClient = container.get<Function>("createClient");
        const storageServiceFactory = container.get<Function>("storageService");

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings) as NocoClient;
        const storageService = storageServiceFactory(client) as StorageService;

        const result = await storageService.upload(filePath);
        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    }
  );
}
