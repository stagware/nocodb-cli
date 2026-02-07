/**
 * Shared command utilities for CLI command handlers.
 * 
 * Centralizes common patterns used across all command files:
 * - Output formatting (printResult)
 * - Error handling (handleError)
 * - Option collection (collect, parseQuery)
 * - Service resolution from container (resolveServices)
 * 
 * @module utils/command-utils
 */

import type { NocoClient } from "@nocodb/sdk";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { WorkspaceConfig } from "../config/types.js";
import { formatJson, formatCsv, formatTable } from "./formatting.js";
import { formatError, getExitCode } from "./error-handling.js";
import { parseKeyValue, validateEntityId } from "./parsing.js";

/**
 * Options for output formatting
 */
export interface OutputOptions {
  pretty?: boolean;
  format?: string;
}

/**
 * Options for JSON input
 */
export interface JsonInputOptions {
  data?: string;
  dataFile?: string;
}

/**
 * Formats and prints result to console based on output options.
 * Respects NOCO_QUIET environment variable.
 * @param result - Data to print
 * @param options - Output formatting options
 */
export function printResult(result: unknown, options: OutputOptions = {}): void {
  if (process.env.NOCO_QUIET === "1") return;

  const format = options.format || "json";
  switch (format) {
    case "csv":
      console.log(formatCsv(result));
      break;
    case "table":
      console.log(formatTable(result));
      break;
    case "json":
    default:
      console.log(formatJson(result, options.pretty || false));
      break;
  }
}

/**
 * Handles errors by printing them to stderr and exiting with the appropriate code.
 * @param err - Error to handle
 * @param verbose - Whether to show verbose error details (defaults to checking --verbose in argv)
 */
export function handleError(err: unknown, verbose = false): void {
  console.error(formatError(err, verbose));
  process.exit(getExitCode(err));
}

/**
 * Collects multiple values for repeatable Commander options.
 * @param value - New value to add
 * @param previous - Previous values
 * @returns Updated array of values
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Parses query string parameters from array of key=value strings.
 * @param items - Array of "key=value" strings
 * @returns Object with parsed query parameters
 */
export function parseQuery(items: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of items) {
    const [key, value] = parseKeyValue(item);
    result[key] = value;
  }
  return result;
}

/**
 * Result of resolving services from the container for a command.
 */
export interface ResolvedServices {
  configManager: ConfigManager;
  createClient: (workspace?: WorkspaceConfig, settings?: any) => NocoClient;
  workspace?: WorkspaceConfig;
  settings: any;
  client: NocoClient;
}

/**
 * Resolves common services from the container and creates a client.
 * Handles alias resolution when a resourceId is provided.
 * 
 * @param container - Dependency injection container
 * @param resourceId - Optional resource ID or alias to resolve
 * @returns Resolved services including a ready-to-use client
 */
export function resolveServices(
  container: Container,
  resourceId?: string,
): ResolvedServices & { resolvedId?: string } {
  const configManager = container.get<ConfigManager>("configManager");
  const createClient = container.get<(workspace?: WorkspaceConfig, settings?: any) => NocoClient>("createClient");

  let resolvedId: string | undefined;
  let aliasWorkspace: WorkspaceConfig | undefined;

  if (resourceId) {
    const validatedId = validateEntityId(resourceId);
    const resolved = configManager.resolveAlias(validatedId);
    resolvedId = resolved.id;
    aliasWorkspace = resolved.workspace;
  }

  const { workspace: effectiveWorkspace, settings } = configManager.getEffectiveConfig({});
  const workspace = aliasWorkspace || effectiveWorkspace;
  const client = createClient(workspace, settings);

  return { configManager, createClient, workspace, settings, client, resolvedId };
}
