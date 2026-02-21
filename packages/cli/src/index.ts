import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBaseIdFromArgv } from "./utils/parsing.js";
import { formatError, getExitCode } from "./utils/error-handling.js";
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
import { ConfigManager, DEFAULT_SETTINGS } from "./config/manager.js";
import { createContainer, type Container } from "./container.js";
import type { GlobalSettings } from "./config/types.js";

// ConfigManager and container - initialized in initializeConfig()
let configManager: ConfigManager;
let container: Container;

const program = new Command();
program
  .name("nocodb")
  .description("NocoDB CLI (v2)")
  .version("0.1.6")
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
      const cm = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = cm.getActiveWorkspaceName() || "default";

      if (key === "baseUrl") {
        // Get or create workspace
        let ws = cm.getWorkspace(activeWorkspaceName);
        if (!ws) {
          ws = {
            baseUrl: value,
            headers: {},
            aliases: {},
          };
          cm.addWorkspace(activeWorkspaceName, ws);
          if (activeWorkspaceName === "default") {
            cm.setActiveWorkspace("default");
          }
        } else {
          ws.baseUrl = value;
          cm.addWorkspace(activeWorkspaceName, ws);
        }

        if (process.env.NOCO_QUIET !== "1") {
          console.log(`baseUrl set for workspace '${activeWorkspaceName}'`);
        }
        return;
      }
      if (key === "baseId") {
        // Get or create workspace
        let ws = cm.getWorkspace(activeWorkspaceName);
        if (!ws) {
          console.error(`No workspace '${activeWorkspaceName}' configured. Set baseUrl first: nocodb config set baseUrl <url>`);
          process.exitCode = 1;
          return;
        } else {
          ws.baseId = value;
          cm.addWorkspace(activeWorkspaceName, ws);
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
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      if (key === "baseUrl") {
        const ws = cm.getActiveWorkspace();
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
        const ws = cm.getActiveWorkspace();
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
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      const ws = cm.getActiveWorkspace();
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
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = cm.getActiveWorkspaceName() || "default";
      let ws = cm.getWorkspace(activeWorkspaceName);
      if (!ws) {
        console.error(`No workspace '${activeWorkspaceName}' configured. Set baseUrl first: nocodb config set baseUrl <url>`);
        process.exitCode = 1;
        return;
      }

      ws.headers[name] = value;
      cm.addWorkspace(activeWorkspaceName, ws);

      if (process.env.NOCO_QUIET !== "1") {
        console.log(`header '${name}' set for workspace '${activeWorkspaceName}'`);
      }
    });

  headerCmd
    .command("delete")
    .argument("name", "Header name")
    .action((name: string) => {
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      const activeWorkspaceName = cm.getActiveWorkspaceName() || "default";
      const ws = cm.getWorkspace(activeWorkspaceName);
      if (ws && ws.headers[name]) {
        delete ws.headers[name];
        cm.addWorkspace(activeWorkspaceName, ws);
      }

      if (process.env.NOCO_QUIET !== "1") {
        console.log(`header '${name}' deleted`);
      }
    });

  headerCmd
    .command("list")
    .action(() => {
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      const ws = cm.getActiveWorkspace();
      const headers = ws?.headers || {};

      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify(headers, null, 2));
      }
    });
}

/**
 * Register settings management commands (backed by ConfigManager)
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
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");
      const settings = cm.getSettings();
      if (process.env.NOCO_QUIET !== "1") {
        console.log(JSON.stringify(settings, null, 2));
      }
    });

  settingsCmd
    .command("path")
    .description("Print the configuration file path")
    .action(() => {
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");
      if (process.env.NOCO_QUIET !== "1") {
        console.log(cm.getConfigPath());
      }
    });

  settingsCmd
    .command("set")
    .argument("key", "Setting key (timeoutMs, retryCount, retryDelay, retryStatusCodes)")
    .argument("value", "Setting value")
    .action((key: string, value: string) => {
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");

      const validKeys: (keyof GlobalSettings)[] = ["timeoutMs", "retryCount", "retryDelay", "retryStatusCodes"];
      if (!validKeys.includes(key as keyof GlobalSettings)) {
        console.error(`Unsupported key '${key}'. Supported keys: ${validKeys.join(", ")}`);
        process.exitCode = 1;
        return;
      }

      if (key === "retryStatusCodes") {
        try {
          const parsed = JSON.parse(value);
          cm.updateSettings({ retryStatusCodes: parsed });
        } catch {
          console.error("Value for retryStatusCodes must be a JSON array, e.g. [429,500,502]");
          process.exitCode = 1;
          return;
        }
      } else {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          console.error(`Value for ${key} must be a finite number`);
          process.exitCode = 1;
          return;
        }
        cm.updateSettings({ [key]: num });
      }

      if (process.env.NOCO_QUIET !== "1") {
        const updated = cm.getSettings();
        console.log(`${key} set to ${JSON.stringify((updated as unknown as Record<string, unknown>)[key])}`);
      }
    });

  settingsCmd
    .command("reset")
    .description("Reset settings to defaults")
    .action(() => {
      initializeConfig();
      const cm = container.get<ConfigManager>("configManager");
      cm.updateSettings({ ...DEFAULT_SETTINGS });
      if (process.env.NOCO_QUIET !== "1") {
        console.log("settings reset to defaults");
      }
    });
}

/**
 * Bootstrap the CLI application
 * Initializes configuration, creates container, registers commands, and parses arguments
 */
async function bootstrap(): Promise<void> {
  try {
    // Initialize configuration and container
    initializeConfig();

    // Register all commands (including the api parent command)
    const apiCmd = createApiCommand(program);
    registerCommands();

    // Handle dynamic API commands if 'api' command is used
    if (process.argv.includes("api")) {
      const baseIdArg = getBaseIdFromArgv(process.argv);
      const cm = container.get<ConfigManager>("configManager");
      const ws = cm.getActiveWorkspace();
      const baseId = baseIdArg ?? ws?.baseId;
      if (!baseId) {
        throw new Error("Base id is not set. Use --base <id> or: nocodb config set baseId <id>");
      }
      const { id: resolvedBaseId } = cm.resolveAlias(baseId);
      await registerDynamicApiCommands(apiCmd, resolvedBaseId, container);
    }

    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(formatError(err, program.opts().verbose));
    process.exitCode = getExitCode(err);
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
