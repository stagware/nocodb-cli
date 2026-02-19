import { Command } from "commander";
import { NocoClient, parseHeader } from "@stagware/nocodb-sdk";
import { parseKeyValue } from "../utils/parsing.js";
import { addJsonInputOptions, addOutputOptions } from "./helpers.js";
import { printResult, handleError, type OutputOptions } from "../utils/command-utils.js";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import type { WorkspaceConfig, GlobalSettings } from "../config/types.js";

/**
 * Registers the raw request command with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerRequestCommand(program: Command, container: Container): void {
  const configManager = container.get<ConfigManager>("configManager");
  const createClient = container.get<(workspace?: WorkspaceConfig, settings?: GlobalSettings) => NocoClient>("createClient");

  const requestCmd = program
    .command("request")
    .description("Make a raw API request")
    .addHelpText("after", `
Examples:
  $ nocodb request GET /api/v2/meta/bases
  $ nocodb request GET /api/v2/meta/bases/p_abc123/tables
  $ nocodb request POST /api/v2/meta/bases -d '{"title":"New Base"}'
  $ nocodb request GET /api/v2/meta/bases -q limit=10 --pretty
`)
    .argument("method", "HTTP method")
    .argument("path", "API path, e.g. /api/v2/meta/projects")
    .option("-q, --query <key=value>", "Query string parameter", collect, [])
    .option("-H, --header <name: value>", "Request header", collect, []);

  addOutputOptions(addJsonInputOptions(requestCmd)).action(
    async (method: string, path: string, options: {
      query: string[];
      header: string[];
      data?: string;
      dataFile?: string;
    } & OutputOptions) => {
      try {
        const query: Record<string, string> = {};
        for (const item of options.query) {
          const [key, value] = parseKeyValue(item);
          query[key] = value;
        }

        const headers: Record<string, string> = {};
        for (const item of options.header) {
          const [key, value] = parseHeader(item);
          headers[key] = value;
        }

        let body: unknown = undefined;
        if (options.data) {
          body = JSON.parse(options.data);
        } else if (options.dataFile) {
          const raw = await import("node:fs/promises").then(fs => fs.readFile(options.dataFile!, "utf8"));
          body = JSON.parse(raw);
        }

        const { workspace, settings } = configManager.getEffectiveConfig({});
        const client = createClient(workspace, settings);
        const result = await client.request(
          method.toUpperCase(),
          path,
          {
            query,
            headers,
            body,
          }
        );

        printResult(result, options);
      } catch (err) {
        handleError(err);
      }
    },
  );
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
