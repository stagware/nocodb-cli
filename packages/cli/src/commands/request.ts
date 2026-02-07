import { Command } from "commander";
import { NocoClient, parseHeader } from "@nocodb/sdk";
import { parseKeyValue } from "../lib.js";
import { addJsonInputOptions, addOutputOptions } from "./helpers.js";
import { formatError, getExitCode } from "../utils/error-handling.js";
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
      pretty?: boolean;
      format?: string;
    }) => {
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

        const client = createClient();
        const result = await client.request(
          method.toUpperCase(),
          path,
          {
            query,
            headers,
            body,
          }
        );

        if (process.env.NOCO_QUIET !== "1") {
          console.log(JSON.stringify(result, null, options.pretty ? 2 : 0));
        }
      } catch (err) {
        console.error(formatError(err, false));
        process.exit(getExitCode(err));
      }
    },
  );
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
