import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";
import { listEndpoints } from "../utils/swagger.js";
import { addOutputOptions } from "./helpers.js";
import { formatError, getExitCode } from "../utils/error-handling.js";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { SwaggerService } from "../services/swagger-service.js";
import { resolveBaseId } from "../utils/command-utils.js";

/**
 * Registers meta utility commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerMetaCommands(program: Command, container: Container): void {
  const swaggerService = container.get<SwaggerService>("swaggerService");
  const metaCmd = program.command("meta").description("Meta utilities")
    .addHelpText("after", `
Examples:
  $ nocodb meta swagger p_abc123
  $ nocodb meta swagger p_abc123 --out swagger.json --pretty
  $ nocodb meta endpoints p_abc123
  $ nocodb meta endpoints p_abc123 --tag Rows
  $ nocodb meta cache clear
`);

  addOutputOptions(
    metaCmd
      .command("swagger")
      .argument("[baseId]", "Base id")
      .option("--out <path>", "Write swagger JSON to a file")
      .option("--no-cache", "Do not use cached swagger"),
  ).action(async (baseId: string | undefined, options: { pretty?: boolean; format?: string; out?: string; cache?: boolean }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const doc = await swaggerService.getSwagger(effectiveBaseId, options.cache !== false);

      if (options.out) {
        await fs.promises.mkdir(path.dirname(options.out), { recursive: true });
        const raw = JSON.stringify(doc, null, options.pretty ? 2 : 0);
        await fs.promises.writeFile(options.out, raw, "utf8");
        console.log(options.out);
        return;
      }

      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify(doc, null, options.pretty ? 2 : 0));
      }
    } catch (err) {
      console.error(formatError(err, false));
      process.exit(getExitCode(err));
    }
  });

  addOutputOptions(
    metaCmd
      .command("endpoints")
      .argument("[baseId]", "Base id")
      .option("--tag <name>", "Filter by tag")
      .option("--no-cache", "Do not use cached swagger"),
  ).action(async (baseId: string | undefined, options: { tag?: string; pretty?: boolean; format?: string; cache?: boolean }) => {
    try {
      const effectiveBaseId = resolveBaseId(container, baseId);
      const doc = await swaggerService.getSwagger(effectiveBaseId, options.cache !== false);
      const endpoints = listEndpoints(doc, options.tag);

      if (options.format === "csv" || options.format === "table") {
        const formatted = endpoints.map((e) => ({ endpoint: e }));
        if (process.env.NOCO_QUIET !== "1") {
          console.log(JSON.stringify(formatted, null, options.pretty ? 2 : 0));
        }
      } else if (options.pretty) {
        console.log(JSON.stringify(endpoints, null, 2));
      } else {
        for (const line of endpoints) {
          console.log(line);
        }
      }
    } catch (err) {
      console.error(formatError(err, false));
      process.exit(getExitCode(err));
    }
  });

  metaCmd
    .command("cache")
    .description("Manage cached swagger docs")
    .command("clear")
    .argument("[baseId]", "Base id (omit to clear all)")
    .option("--all", "Clear all cached swagger docs")
    .action(async (baseId: string | undefined, options: { all?: boolean }) => {
      try {
        if (options.all || !baseId) {
          await swaggerService.invalidateAllCache();
          if (process.env.NOCO_QUIET !== "1") {
            console.log("swagger cache cleared");
          }
          return;
        }

        const configManager = container.get<ConfigManager>("configManager");
        const { id: resolvedBaseId } = configManager.resolveAlias(baseId);
        swaggerService.invalidateCache(resolvedBaseId);
        if (process.env.NOCO_QUIET !== "1") {
          console.log(`swagger cache cleared for ${resolvedBaseId}`);
        }
      } catch (err) {
        console.error(formatError(err, false));
        process.exit(getExitCode(err));
      }
    });
}
