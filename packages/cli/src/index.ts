#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetaApi, NocoClient } from "@nocodb/sdk";
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
  .version("0.1.0")
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
}

/**
 * Register config management commands
 */
function registerConfigCommands(): void {
  const configCmd = program.command("config").description("Manage CLI configuration");

  configCmd
    .command("set")
    .argument("key", "Configuration key")
    .argument("value", "Configuration value")
    .action((key: string, value: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");
      
      if (key === "baseUrl") {
        // Get or create default workspace
        let ws = configManager.getWorkspace("default");
        if (!ws) {
          ws = {
            baseUrl: value,
            headers: {},
            aliases: {},
          };
          configManager.addWorkspace("default", ws);
          configManager.setActiveWorkspace("default");
        } else {
          ws.baseUrl = value;
          configManager.addWorkspace("default", ws);
        }
        
        if (process.env.NOCO_QUIET !== "1") {
          console.log("baseUrl set");
        }
        return;
      }
      if (key === "baseId") {
        // Get or create default workspace
        let ws = configManager.getWorkspace("default");
        if (!ws) {
          ws = {
            baseUrl: "",
            headers: {},
            baseId: value,
            aliases: {},
          };
          configManager.addWorkspace("default", ws);
          configManager.setActiveWorkspace("default");
        } else {
          ws.baseId = value;
          configManager.addWorkspace("default", ws);
        }
        
        if (process.env.NOCO_QUIET !== "1") {
          console.log("baseId set");
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
        const ws = configManager.getWorkspace("default") || configManager.getActiveWorkspace();
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
        const ws = configManager.getWorkspace("default") || configManager.getActiveWorkspace();
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
      
      const ws = configManager.getWorkspace("default") || configManager.getActiveWorkspace();
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
  const headerCmd = program.command("header").description("Manage default headers");

  headerCmd
    .command("set")
    .argument("name", "Header name")
    .argument("value", "Header value")
    .action((name: string, value: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");
      
      // Get or create default workspace
      let ws = configManager.getWorkspace("default");
      if (!ws) {
        // If no workspace exists, user needs to set baseUrl first
        console.error("No workspace configured. Set baseUrl first: nocodb config set baseUrl <url>");
        process.exitCode = 1;
        return;
      }
      
      ws.headers[name] = value;
      configManager.addWorkspace("default", ws);
      
      if (process.env.NOCO_QUIET !== "1") {
        console.log(`header '${name}' set`);
      }
    });

  headerCmd
    .command("delete")
    .argument("name", "Header name")
    .action((name: string) => {
      // Initialize config and container if not already done
      initializeConfig();
      const configManager = container.get<ConfigManager>("configManager");
      
      const ws = configManager.getWorkspace("default");
      if (ws && ws.headers[name]) {
        delete ws.headers[name];
        configManager.addWorkspace("default", ws);
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
      
      const ws = configManager.getWorkspace("default") || configManager.getActiveWorkspace();
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
  const settingsCmd = program.command("settings").description("Manage CLI settings (timeout, retries)");

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
    const entryPath = path.resolve(process.argv[1]);
    const currentPath = path.resolve(fileURLToPath(import.meta.url));
    return entryPath === currentPath;
  } catch {
    return true;
  }
}

if (shouldAutoRun()) {
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
