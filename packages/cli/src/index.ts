import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetaApi, NocoClient } from "@stagware/nocodb-sdk";
import {
  getBaseIdFromArgv as parseBaseIdArgv,
  handleError,
  isHttpMethod,
  isSwaggerDoc,
  parseKeyValue,
  type SwaggerDoc,
} from "./lib.js";
import { createConfig, deleteHeader, getHeaders, setHeader } from "./config.js";
import { loadSettings, saveSettings, resetSettings, getSettingsPath, DEFAULT_SETTINGS, type Settings } from "./settings.js";
import { loadMultiConfig, resolveNamespacedAlias, type MultiConfig, type WorkspaceConfig } from "./aliases.js";
import { registerRowsCommands } from "./commands/rows.js";
import { registerMetaCommands } from "./commands/meta.js";
import { registerLinksCommands } from "./commands/links.js";
import { createApiCommand, registerDynamicApiCommands } from "./commands/api.js";
import { registerStorageCommands } from "./commands/storage.js";
import { registerWorkspaceAliasCommands } from "./commands/workspace-alias.js";
import { registerRequestCommand } from "./commands/request.js";
import { registerSchemaCommands } from "./commands/schema.js";
import { registerDataIoCommands } from "./commands/data-io.js";
import { registerMetaCrudCommands } from "./commands/meta-crud.js";
import { registerMeCommand } from "./commands/me.js";
import { registerHooksCommands } from "./commands/hooks.js";
import { registerTokensCommands } from "./commands/tokens.js";
import { registerUsersCommands } from "./commands/users.js";
import { registerSourcesCommands } from "./commands/sources.js";
import { registerCommentsCommands } from "./commands/comments.js";
import { registerSharedViewsCommands } from "./commands/shared-views.js";
import { registerSharedBaseCommands } from "./commands/shared-base.js";
import { registerFilterChildrenCommands } from "./commands/filter-children.js";
import { registerHookFiltersCommands } from "./commands/hook-filters.js";
import { registerSetPrimaryCommands } from "./commands/set-primary.js";
import { registerDuplicateCommands } from "./commands/duplicate.js";
import { registerVisibilityRulesCommands } from "./commands/visibility-rules.js";
import { registerAppInfoCommand } from "./commands/app-info.js";
import { registerCloudWorkspaceCommands } from "./commands/cloud-workspace.js";
import { ConfigManager } from "./config/manager.js";
import { createContainer, type Container } from "./container.js";

const config = createConfig();
const settings = loadSettings();
let multiConfig = loadMultiConfig();

// ConfigManager and container - initialized in initializeConfig()
let configManager: ConfigManager;
let container: Container;

function getActiveWorkspaceName(): string | undefined {
  return config.get("activeWorkspace") as string | undefined;
}

function getActiveWorkspace(): WorkspaceConfig | undefined {
  const name = getActiveWorkspaceName();
  return name ? multiConfig[name] : undefined;
}

function getBaseUrl(): string {
  const ws = getActiveWorkspace();
  if (ws?.baseUrl) return ws.baseUrl;

  const baseUrl = config.get("baseUrl");
  if (!baseUrl) {
    throw new Error(
      "Base URL is not set. Run either: nocodb workspace add <name> <url> <token> or: nocodb config set baseUrl <url>",
    );
  }
  return baseUrl;
}

function getBaseId(fallback?: string): string {
  const ws = getActiveWorkspace();
  const baseId = fallback ?? ws?.baseId ?? config.get("baseId");

  if (!baseId) {
    throw new Error("Base id is not set. Use --base <id> or: nocodb config set baseId <id>");
  }
  return resolveNamespacedAlias(baseId, multiConfig, getActiveWorkspaceName()).id;
}

function getHeadersConfig(): Record<string, string> {
  const ws = getActiveWorkspace();
  const wsHeaders = ws?.headers ?? {};
  return { ...getHeaders(config), ...wsHeaders };
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await fs.promises.readFile(path, "utf8");
  return JSON.parse(raw);
}

function getCacheDir(): string {
  const configPath = config.path;
  const dir = path.dirname(configPath);
  return path.join(dir, "cache");
}

async function writeJsonFile(filePath: string, data: unknown, pretty?: boolean): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const raw = JSON.stringify(data, null, pretty ? 2 : 0);
  await fs.promises.writeFile(filePath, raw, "utf8");
}

async function readJsonInput(data?: string, dataFile?: string): Promise<unknown> {
  if (dataFile) {
    return readJsonFile(dataFile);
  }
  if (data) {
    return JSON.parse(data);
  }
  throw new Error("Provide --data or --data-file");
}


function clientOptionsFromSettings() {
  const opts = program.opts();
  const timeoutMs = opts.timeout ? Number(opts.timeout) : settings.timeoutMs;
  const retryCount = opts.retries != null ? Number(opts.retries) : settings.retryCount;
  return {
    timeoutMs,
    retry: {
      retry: retryCount === 0 ? (false as const) : retryCount,
      retryDelay: settings.retryDelay,
      retryStatusCodes: settings.retryStatusCodes,
    },
  };
}

function createMeta(): MetaApi {
  const baseUrl = getBaseUrl();
  const headers = getHeadersConfig();
  const client = new NocoClient({ baseUrl, headers, ...clientOptionsFromSettings() });
  return new MetaApi(client);
}

const program = new Command();
program
  .name("nocodb")
  .description("NocoDB CLI (v2)")
  .version("0.1.5")
  .option("--base <baseId>", "Default base id for dynamic API calls")
  .option("--timeout <ms>", "Request timeout in milliseconds")
  .option("--retries <count>", "Number of retries (0 to disable)")
  .option("--verbose", "Show verbose error output including stack traces");

/**
 * Initialize configuration and dependency injection container
 */
function initializeConfig(): void {
  if (!configManager) {
    configManager = new ConfigManager();
    container = createContainer(configManager);
  }
}

/**
 * Register all CLI commands with the program
 */
function registerCommands(): void {
  // Config commands
  registerConfigCommands();

  // Header commands
  registerHeaderCommands();

  // Settings commands
  registerSettingsCommands();

  // Domain commands (using container)
  registerWorkspaceAliasCommands(program, container);
  registerMetaCrudCommands(program, container);
  registerRowsCommands(program, container);
  registerLinksCommands(program, container);
  registerStorageCommands(program, container);
  registerSchemaCommands(program, container);
  registerDataIoCommands(program, container);
  registerMetaCommands(program, container);
  registerRequestCommand(program, container);
  registerMeCommand(program, container);
  registerHooksCommands(program, container);
  registerTokensCommands(program, container);
  registerUsersCommands(program, container);
  registerSourcesCommands(program, container);
  registerCommentsCommands(program, container);
  registerSharedViewsCommands(program, container);
  registerSharedBaseCommands(program, container);
  registerDuplicateCommands(program, container);
  registerVisibilityRulesCommands(program, container);
  registerAppInfoCommand(program, container);

  // Subcommands that attach to existing command groups (must come after parent registration)
  registerFilterChildrenCommands(program, container);
  registerHookFiltersCommands(program, container);
  registerSetPrimaryCommands(program, container);
  registerCloudWorkspaceCommands(program, container);
}

/**
 * Register config management commands
 */
function registerConfigCommands(): void {
  const configCmd = program.command("config").description("Manage CLI configuration")
    .addHelpText("after", `
Examples:
  $ nocodb config set baseUrl https://noco.example.com
  $ nocodb config set baseId p_abc123
  $ nocodb config get baseUrl
  $ nocodb config show
`);

  configCmd
    .command("set")
    .argument("key", "Configuration key")
    .argument("value", "Configuration value")
    .action((key: string, value: string) => {
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = configManager.getActiveWorkspaceName() || "default";

      if (key === "baseUrl") {
        // Get or create workspace
        let ws = configManager.getWorkspace(activeWorkspaceName);
        if (!ws) {
          ws = {
            baseUrl: value,
            headers: {},
            aliases: {},
          };
          configManager.addWorkspace(activeWorkspaceName, ws);
          if (activeWorkspaceName === "default") {
            configManager.setActiveWorkspace("default");
          }
        } else {
          ws.baseUrl = value;
          configManager.addWorkspace(activeWorkspaceName, ws);
        }

        if (process.env.NOCO_QUIET !== "1") {
          console.log(`baseUrl set for workspace '${activeWorkspaceName}'`);
        }
        return;
      }
      if (key === "baseId") {
        // Get or create workspace
        let ws = configManager.getWorkspace(activeWorkspaceName);
        if (!ws) {
          console.error(`No workspace '${activeWorkspaceName}' configured. Set baseUrl first: nocodb config set baseUrl <url>`);
          process.exitCode = 1;
          return;
        } else {
          ws.baseId = value;
          configManager.addWorkspace(activeWorkspaceName, ws);
        }

        if (process.env.NOCO_QUIET !== "1") {
          console.log(`baseId set for workspace '${activeWorkspaceName}'`);
        }
        return;
      }
      console.error("Unsupported key. Supported keys: baseUrl, baseId");
      process.exitCode = 1;
    });

  configCmd
    .command("get")
    .argument("key", "Configuration key")
    .action((key: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      if (key === "baseUrl") {
        const ws = configManager.getActiveWorkspace();
        const baseUrl = ws?.baseUrl;
        if (!baseUrl) {
          console.error("baseUrl is not set");
          process.exitCode = 1;
          return;
        }
        if (process.env.NOCO_QUIET !== "1") {
          console.log(baseUrl);
        }
        return;
      }
      if (key === "baseId") {
        const ws = configManager.getActiveWorkspace();
        const baseId = ws?.baseId;
        if (!baseId) {
          console.error("baseId is not set");
          process.exitCode = 1;
          return;
        }
        if (process.env.NOCO_QUIET !== "1") {
          console.log(baseId);
        }
        return;
      }
      console.error("Unsupported key. Supported keys: baseUrl, baseId");
      process.exitCode = 1;
    });

  configCmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      const ws = configManager.getActiveWorkspace();
      const baseUrl = ws?.baseUrl ?? null;
      const baseId = ws?.baseId ?? null;
      const headers = ws?.headers ?? {};

      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify({ baseUrl, baseId, headers }, null, 2));
      }
    });
}

/**
 * Register header management commands
 */
function registerHeaderCommands(): void {
  const headerCmd = program.command("header").description("Manage default headers")
    .addHelpText("after", `
Examples:
  $ nocodb header set xc-token my-api-token
  $ nocodb header list
  $ nocodb header delete xc-token
`);

  headerCmd
    .command("set")
    .argument("name", "Header name")
    .argument("value", "Header value")
    .action((name: string, value: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = configManager.getActiveWorkspaceName() || "default";
      let ws = configManager.getWorkspace(activeWorkspaceName);
      if (!ws) {
        console.error(`No workspace '${activeWorkspaceName}' configured. Set baseUrl first: nocodb config set baseUrl <url>`);
        process.exitCode = 1;
        return;
      }

      ws.headers[name] = value;
      configManager.addWorkspace(activeWorkspaceName, ws);

      if (process.env.NOCO_QUIET !== "1") {
        console.log(`header '${name}' set for workspace '${activeWorkspaceName}'`);
      }
    });

  headerCmd
    .command("delete")
    .argument("name", "Header name")
    .action((name: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = configManager.getActiveWorkspaceName() || "default";
      const ws = configManager.getWorkspace(activeWorkspaceName);
      if (ws && ws.headers[name]) {
        delete ws.headers[name];
        configManager.addWorkspace(activeWorkspaceName, ws);
      }

      if (process.env.NOCO_QUIET !== "1") {
        console.log(`header '${name}' deleted`);
      }
    });

  headerCmd
    .command("list")
    .action(() => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");

      const ws = configManager.getActiveWorkspace();
      const headers = ws?.headers || {};

      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify(headers, null, 2));
      }
    });
}

/**
 * Register settings management commands
 */
function registerSettingsCommands(): void {
  const settingsCmd = program.command("settings").description("Manage CLI settings (timeout, retries)")
    .addHelpText("after", `
Examples:
  $ nocodb settings show
  $ nocodb settings set timeoutMs 30000
  $ nocodb settings set retryCount 3
  $ nocodb settings set retryStatusCodes '[429,500,502]'
  $ nocodb settings reset
  $ nocodb settings path
`);

  settingsCmd
    .command("show")
    .description("Show current effective settings")
    .action(() => {
      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify(settings, null, 2));
      }
    });

  settingsCmd
    .command("path")
    .description("Print the settings file path")
    .action(() => {
      if (process.env.NOCO_QUIET !== "1") {
        console.log(getSettingsPath());
      }
    });

  settingsCmd
    .command("set")
    .argument("key", "Setting key (timeoutMs, retryCount, retryDelay, retryStatusCodes)")
    .argument("value", "Setting value")
    .action((key: string, value: string) => {
      const validKeys: (keyof Settings)[] = ["timeoutMs", "retryCount", "retryDelay", "retryStatusCodes"];
      if (!validKeys.includes(key as keyof Settings)) {
        console.error(`Unsupported key '${key}'. Supported keys: ${validKeys.join(", ")}`);
        process.exitCode = 1;
        return;
      }
      const current = loadSettings();
      if (key === "retryStatusCodes") {
        try {
          current.retryStatusCodes = JSON.parse(value);
        } catch {
          console.error("Value for retryStatusCodes must be a JSON array, e.g. [429,500,502]");
          process.exitCode = 1;
          return;
        }
      } else {
        (current as any)[key] = Number(value);
      }
      saveSettings(current);
      if (process.env.NOCO_QUIET !== "1") {
        console.log(`${key} set to ${JSON.stringify((current as any)[key])}`);
      }
    });

  settingsCmd
    .command("reset")
    .description("Reset settings to defaults")
    .action(() => {
      resetSettings();
      if (process.env.NOCO_QUIET !== "1") {
        console.log("settings reset to defaults");
      }
    });
}

const apiCmd = createApiCommand(program);

/**
 * Bootstrap the CLI application
 * Initializes configuration, creates container, registers commands, and parses arguments
 */
async function bootstrap(): Promise<void> {
  try {
    // Initialize configuration and container
    initializeConfig();

    // Register all commands
    registerCommands();

    // Handle dynamic API commands if 'api' command is used
    if (process.argv.includes("api")) {
      const baseId = getBaseId(getBaseIdFromArgv());
      await registerDynamicApiCommands(apiCmd, baseId, container);
    }

    await program.parseAsync(process.argv);
  } catch (err) {
    handleError(err);
  }
}

function shouldAutoRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const entryReal = fs.realpathSync(path.resolve(process.argv[1]));
    const selfReal = fs.realpathSync(path.resolve(fileURLToPath(import.meta.url)));
    if (entryReal === selfReal) return true;
    // When installed via npm, process.argv[1] points to a bin shim (e.g. .cmd
    // on Windows) rather than the actual JS file. Detect this: if argv[1]
    // resolved to a real file but is not a JS/TS module, it is a bin wrapper.
    if (!/\.[cm]?[jt]s$/.test(entryReal)) return true;
    return false;
  } catch {
    // realpathSync throws when argv[1] doesn't exist on disk (e.g. tests set
    // process.argv = ["node", "nocodb", ...]) — do not auto-run in that case.
    return false;
  }
}

if ((import.meta as any).main || shouldAutoRun()) {
  bootstrap();
}

export { bootstrap };

function getBaseIdFromArgv(): string | undefined {
  return parseBaseIdArgv(process.argv);
}

async function loadSwagger(baseId: string, useCache: boolean): Promise<SwaggerDoc> {
  const cacheFile = path.join(getCacheDir(), `swagger-${baseId}.json`);
  if (useCache) {
    try {
      const cached = (await readJsonFile(cacheFile)) as SwaggerDoc;
      if (isSwaggerDoc(cached)) {
        return cached;
      }
    } catch {
      // ignore
    }
  }
  const meta = createMeta();
  const doc = (await meta.getBaseSwagger(baseId)) as SwaggerDoc;
  await writeJsonFile(cacheFile, doc, true);
  return doc;
}

async function ensureSwaggerCache(baseId: string): Promise<void> {
  const cacheFile = path.join(getCacheDir(), `swagger-${baseId}.json`);
  if (!fs.existsSync(cacheFile)) {
    await loadSwagger(baseId, true);
  }
}
