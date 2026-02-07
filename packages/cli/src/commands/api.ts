/**
 * API command handlers for dynamic swagger-based API commands.
 * 
 * This module provides dynamic command generation from swagger documentation,
 * allowing users to call any API endpoint defined in the swagger spec.
 * 
 * @module commands/api
 */

import { Command } from "commander";
import { parseHeader } from "@nocodb/sdk";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { SwaggerService } from "../services/swagger-service.js";
import type { NocoClient } from "@nocodb/sdk";
import { parseJsonInput, parseKeyValue } from "../utils/parsing.js";
import { addOutputOptions, addJsonInputOptions } from "./helpers.js";
import type { SwaggerDoc, Operation } from "../utils/swagger.js";
import { validateRequestBody } from "../utils/swagger.js";
import { printResult, handleError, collect } from "../utils/command-utils.js";

/**
 * Extracts operations from swagger document
 */
function extractOperations(swagger: SwaggerDoc): Operation[] {
  const operations: Operation[] = [];
  
  if (!swagger.paths) return operations;
  
  for (const [path, pathItem] of Object.entries(swagger.paths)) {
    if (!pathItem) continue;
    
    for (const method of ["get", "post", "put", "patch", "delete", "options", "head"]) {
      const operation = pathItem[method];
      if (operation) {
        operations.push({
          method,
          path,
          operationId: operation.operationId,
          tags: operation.tags,
          summary: operation.summary,
          description: operation.description,
          parameters: operation.parameters,
          requestBody: operation.requestBody,
          responses: operation.responses,
        });
      }
    }
  }
  
  return operations;
}

/**
 * Extracts path parameter names from a path template
 */
function getPathParamNames(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Applies path parameters to a path template
 */
function applyPathParams(path: string, paramNames: string[], paramValues: string[]): string {
  let result = path;
  for (let i = 0; i < paramNames.length; i++) {
    result = result.replace(`{${paramNames[i]}}`, paramValues[i] || "");
  }
  return result;
}

/**
 * Converts a string to a slug (lowercase, hyphens)
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates the api command
 */
export function createApiCommand(program: Command): Command {
  return program.command("api").description("Dynamic API commands from base swagger");
}

/**
 * Registers dynamic API commands from swagger documentation
 * @param parent - Parent command to attach dynamic commands to
 * @param baseId - Base ID to load swagger for
 * @param container - Dependency injection container
 */
export async function registerDynamicApiCommands(
  parent: Command,
  baseId: string,
  container: Container
): Promise<void> {
  try {
    const configManager = container.get<ConfigManager>("configManager");
    const swaggerService = container.get<SwaggerService>("swaggerService");
    const createClient = container.get<Function>("createClient");

    // Load swagger document
    const swagger = await swaggerService.getSwagger(baseId);
    const operations = extractOperations(swagger);
    const tags = new Map<string, { cmd: Command; names: Set<string> }>();

    let opCounter = 0;
    for (const op of operations) {
      const tag = op.tags?.[0] ?? "default";
      const safeTag = slugify(tag);
      let tagEntry = tags.get(safeTag);
      if (!tagEntry) {
        tagEntry = { cmd: parent.command(safeTag).description(tag), names: new Set() };
        tags.set(safeTag, tagEntry);
      }

      let opName = slugify(op.operationId ?? `${op.method}-${op.path}`);
      if (!opName) {
        opCounter += 1;
        opName = `operation-${opCounter}`;
      }
      if (tagEntry.names.has(opName)) {
        opCounter += 1;
        opName = `${opName}-${opCounter}`;
      }
      tagEntry.names.add(opName);

      const pathParamNames = getPathParamNames(op.path);
      const opCmd = tagEntry.cmd.command(opName).description(`${op.method.toUpperCase()} ${op.path}`);
      for (const paramName of pathParamNames) {
        opCmd.argument(paramName, `Path param: ${paramName}`);
      }

      addOutputOptions(
        addJsonInputOptions(
          opCmd
            .option("-q, --query <key=value>", "Query string parameter", collect, [])
            .option("-H, --header <name: value>", "Request header", collect, [])
        )
      ).action(async (...args: unknown[]) => {
        try {
          const cmd = args[args.length - 1] as Command;
          const options = cmd.opts<{
            query: string[];
            header: string[];
            data?: string;
            dataFile?: string;
            pretty?: boolean;
            format?: string;
          }>();

          const pathArgs = args.slice(0, pathParamNames.length) as string[];
          const finalPath = applyPathParams(op.path, pathParamNames, pathArgs);

          // Parse query parameters
          const query: Record<string, string> = {};
          for (const item of options.query ?? []) {
            const [key, value] = parseKeyValue(item);
            query[key] = value;
          }

          // Parse request headers
          const requestHeaders: Record<string, string> = {};
          for (const item of options.header ?? []) {
            const [name, value] = parseHeader(item);
            requestHeaders[name] = value;
          }

          // Parse request body
          const body = options.data || options.dataFile
            ? await parseJsonInput(options.data, options.dataFile)
            : undefined;

          // Validate request body against swagger
          if (body !== undefined) {
            validateRequestBody(op, swagger, body);
          }

          // Create client and make request
          const { workspace, settings } = configManager.getEffectiveConfig({});
          const client = createClient(workspace, settings) as NocoClient;
          const result = await client.request(op.method.toUpperCase(), finalPath, {
            query: Object.keys(query).length ? query : undefined,
            headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
            body,
          });

          printResult(result, options);
        } catch (err) {
          handleError(err);
        }
      });
    }
  } catch (err) {
    handleError(err);
  }
}

export type { Operation };
