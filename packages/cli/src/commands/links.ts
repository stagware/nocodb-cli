/**
 * Links command handlers for managing linked records.
 * 
 * @module commands/links
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { LinkService } from "../services/link-service.js";
import type { NocoClient } from "@nocodb/sdk";
import { parseJsonInput } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "./helpers.js";
import {
  printResult, handleError, collect, parseQuery,
  type OutputOptions, type JsonInputOptions,
} from "../utils/command-utils.js";

/**
 * Registers links commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerLinksCommands(program: Command, container: Container): void {
  const linksCmd = program.command("links").description("Manage linked records");

  // List links command
  addOutputOptions(
    linksCmd
      .command("list")
      .argument("tableId", "Table id or alias")
      .argument("linkFieldId", "Link field id")
      .argument("recordId", "Record id")
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
  ).action(async (
    tableId: string,
    linkFieldId: string,
    recordId: string,
    options: { query: string[] } & OutputOptions
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const linkServiceFactory = container.get<Function>("linkService");

      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      const client = createClient(ws, settings) as NocoClient;
      const linkService = linkServiceFactory(client) as LinkService;

      const query = parseQuery(options.query || []);
      const result = await linkService.list(
        resolvedTableId,
        linkFieldId,
        recordId,
        Object.keys(query).length ? query : undefined
      );

      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Create links command
  addOutputOptions(
    addJsonInputOptions(
      linksCmd
        .command("create")
        .argument("tableId", "Table id or alias")
        .argument("linkFieldId", "Link field id")
        .argument("recordId", "Record id"),
      "Request JSON body (array of {Id: ...})"
    )
  ).action(async (
    tableId: string,
    linkFieldId: string,
    recordId: string,
    options: JsonInputOptions & OutputOptions
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const linkServiceFactory = container.get<Function>("linkService");

      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      const client = createClient(ws, settings) as NocoClient;
      const linkService = linkServiceFactory(client) as LinkService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await linkService.link(resolvedTableId, linkFieldId, recordId, body);

      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });

  // Delete links command
  addOutputOptions(
    addJsonInputOptions(
      linksCmd
        .command("delete")
        .argument("tableId", "Table id or alias")
        .argument("linkFieldId", "Link field id")
        .argument("recordId", "Record id"),
      "Request JSON body (array of {Id: ...})"
    )
  ).action(async (
    tableId: string,
    linkFieldId: string,
    recordId: string,
    options: JsonInputOptions & OutputOptions
  ) => {
    try {
      const configManager = container.get<ConfigManager>("configManager");
      const createClient = container.get<Function>("createClient");
      const linkServiceFactory = container.get<Function>("linkService");

      const { id: resolvedTableId, workspace } = configManager.resolveAlias(tableId);
      const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
      const ws = workspace || effectiveWorkspace;

      const client = createClient(ws, settings) as NocoClient;
      const linkService = linkServiceFactory(client) as LinkService;

      const body = await parseJsonInput(options.data, options.dataFile);
      const result = await linkService.unlink(resolvedTableId, linkFieldId, recordId, body);

      printResult(result, options);
    } catch (err) {
      handleError(err);
    }
  });
}
