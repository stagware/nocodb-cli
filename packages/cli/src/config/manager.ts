/**
 * Unified configuration manager for the NocoDB CLI.
 * 
 * This module provides a single, coherent configuration management system:
 * 
 * - Multi-workspace support with workspace-scoped configuration
 * - Clear configuration precedence rules
 * - Alias resolution with namespace support
 * - Configuration validation
 * 
 * @module config/manager
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ValidationError } from "@stagware/nocodb-sdk";
import type { UnifiedConfig, WorkspaceConfig, GlobalSettings } from "./types.js";

/**
 * Default global settings for HTTP client behavior.
 */
export const DEFAULT_SETTINGS: GlobalSettings = {
  timeoutMs: 30000,
  retryCount: 3,
  retryDelay: 1000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Unified configuration manager that consolidates config, settings, and aliases.
 * 
 * The ConfigManager provides a single interface for managing all CLI configuration,
 * including workspace management, alias resolution, and configuration precedence.
 * 
 * @example
 * ```typescript
 * // Create a config manager
 * const configManager = new ConfigManager();
 * 
 * // Add a workspace
 * configManager.addWorkspace('production', {
 *   baseUrl: 'https://app.nocodb.com',
 *   headers: { 'xc-token': 'your-token' },
 *   baseId: 'p1234567890abcdef',
 *   aliases: {}
 * });
 * 
 * // Set active workspace
 * configManager.setActiveWorkspace('production');
 * 
 * // Resolve an alias
 * const { id, workspace } = configManager.resolveAlias('users');
 * 
 * // Get effective configuration with precedence
 * const { workspace, settings } = configManager.getEffectiveConfig({
 *   timeoutMs: 60000  // CLI flag override
 * });
 * ```
 */
export class ConfigManager {
  private config: UnifiedConfig;
  private configDir: string;
  private configPath: string;

  /**
   * Creates a new ConfigManager instance.
   * 
   * The manager will load existing configuration or create a new one with
   * defaults. The configuration directory can be customized via the
   * NOCODB_SETTINGS_DIR or NOCO_CONFIG_DIR environment variables.
   * 
   * @param configDir - Optional custom configuration directory path
   */
  constructor(configDir?: string) {
    this.configDir = this.resolveConfigDir(configDir);
    this.configPath = path.join(this.configDir, "config.json");
    this.config = this.load();
  }

  /**
   * Resolves the configuration directory path.
   * 
   * Priority:
   * 1. Explicit configDir parameter
   * 2. NOCODB_SETTINGS_DIR environment variable
   * 3. NOCO_CONFIG_DIR environment variable
   * 4. Default: ~/.nocodb-cli
   * 
   * @param configDir - Optional explicit directory path
   * @returns Resolved configuration directory path
   */
  private resolveConfigDir(configDir?: string): string {
    if (configDir) return configDir;
    if (process.env.NOCODB_SETTINGS_DIR) return process.env.NOCODB_SETTINGS_DIR;
    if (process.env.NOCO_CONFIG_DIR) return process.env.NOCO_CONFIG_DIR;
    return path.join(os.homedir(), ".nocodb-cli");
  }

  /**
   * Loads existing configuration or creates a new one with defaults.
   * 
   * @returns Loaded or default unified configuration
   */
  private load(): UnifiedConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf8");
        const parsed = JSON.parse(raw) as UnifiedConfig;

        if (parsed.version === 2) {
          // Ensure all workspaces have required properties
          for (const name of Object.keys(parsed.workspaces)) {
            if (!parsed.workspaces[name].headers) {
              parsed.workspaces[name].headers = {};
            }
            if (!parsed.workspaces[name].aliases) {
              parsed.workspaces[name].aliases = {};
            }
          }
          // Ensure settings exist with defaults for any missing keys
          parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
          return parsed;
        }
      } catch {
        console.warn(`Warning: Failed to parse ${this.configPath}, starting with defaults`);
      }
    }

    // Return default config
    return {
      version: 2,
      workspaces: {},
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  /**
   * Gets the currently active workspace configuration.
   * 
   * @returns Active workspace configuration or undefined if no workspace is active
   */
  getActiveWorkspace(): WorkspaceConfig | undefined {
    if (!this.config.activeWorkspace) return undefined;
    return this.getWorkspace(this.config.activeWorkspace);
  }

  /**
   * Sets the active workspace by name.
   * 
   * @param name - Name of the workspace to activate
   * @throws {ValidationError} If the workspace doesn't exist
   */
  setActiveWorkspace(name: string): void {
    if (!this.config.workspaces[name]) {
      throw new ValidationError(`Workspace '${name}' does not exist`);
    }
    this.config.activeWorkspace = name;
    this.save();
  }

  /**
   * Gets the name of the active workspace.
   */
  getActiveWorkspaceName(): string | undefined {
    const name = this.config.activeWorkspace;
    if (name && !this.config.workspaces[name]) return undefined;
    return name;
  }

  /**
   * Adds or updates a workspace configuration.
   * 
   * This method validates the workspace configuration before saving.
   * 
   * @param name - Name of the workspace
   * @param config - Workspace configuration
   * @throws {ValidationError} If the configuration is invalid
   */
  addWorkspace(name: string, config: WorkspaceConfig): void {
    // Validate workspace config
    this.validateWorkspaceConfig(config);

    this.config.workspaces[name] = config;
    this.save();
  }

  /**
   * Removes a workspace by name.
   * 
   * If the removed workspace was active, clears the active workspace.
   * 
   * @param name - Name of the workspace to remove
   * @returns true if workspace was removed, false if it didn't exist
   */
  removeWorkspace(name: string): boolean {
    if (!this.config.workspaces[name]) {
      return false;
    }

    delete this.config.workspaces[name];

    // Clear active workspace if it was the one removed
    if (this.config.activeWorkspace === name) {
      this.config.activeWorkspace = undefined;
    }

    this.save();
    return true;
  }

  /**
   * Lists all workspace names.
   * 
   * @returns Array of workspace names
   */
  listWorkspaces(): string[] {
    return Object.keys(this.config.workspaces);
  }

  /**
   * Gets a workspace configuration by name.
   * 
   * @param name - Name of the workspace
   * @returns Workspace configuration or undefined if not found
   */
  getWorkspace(name: string): WorkspaceConfig | undefined {
    const ws = this.config.workspaces[name];
    if (!ws) return undefined;
    return this.copyWorkspace(ws);
  }

  /**
   * Creates a shallow defensive copy of a workspace config.
   */
  private copyWorkspace(ws: WorkspaceConfig): WorkspaceConfig {
    return {
      ...ws,
      headers: { ...ws.headers },
      aliases: { ...ws.aliases },
    };
  }

  /**
   * Resolves an alias to its UUID with workspace context.
   * 
   * Resolution rules (in order):
   * 1. Explicit namespace (workspace.alias) - checks specified workspace
   * 2. Active workspace - checks current workspace's aliases
   * 3. Workspace-level alias - checks if input is a workspace name with baseId
   * 4. Pass-through - returns input as-is (assumes it's already a UUID)
   * 
   * @param input - Alias or UUID to resolve
   * @returns Object containing resolved ID and optional workspace context
   */
  resolveAlias(input: string): { id: string; workspace?: WorkspaceConfig } {
    // 1. Check for explicit namespace (workspace.alias)
    const dotIndex = input.indexOf(".");
    if (dotIndex !== -1) {
      const wsName = input.slice(0, dotIndex);
      const alias = input.slice(dotIndex + 1);
      const ws = this.config.workspaces[wsName];
      if (ws?.aliases[alias]) {
        return { id: ws.aliases[alias], workspace: this.copyWorkspace(ws) };
      }
    }

    // 2. Check active workspace
    const activeWs = this.getActiveWorkspace();
    if (activeWs?.aliases[input]) {
      return { id: activeWs.aliases[input], workspace: activeWs };
    }

    // 3. Check for workspace-level alias (workspace name -> baseId)
    const ws = this.config.workspaces[input];
    if (ws?.baseId) {
      return { id: ws.baseId, workspace: this.copyWorkspace(ws) };
    }

    // 4. Pass-through (assume it's already a UUID)
    return { id: input };
  }

  /**
   * Adds or updates an alias in a workspace.
   * 
   * @param workspaceName - Name of the workspace
   * @param alias - Alias name
   * @param id - UUID to map to
   * @throws {ValidationError} If the workspace doesn't exist
   */
  setAlias(workspaceName: string, alias: string, id: string): void {
    const ws = this.config.workspaces[workspaceName];
    if (!ws) {
      throw new ValidationError(`Workspace '${workspaceName}' does not exist`);
    }

    ws.aliases[alias] = id;
    this.save();
  }

  /**
   * Removes an alias from a workspace.
   * 
   * @param workspaceName - Name of the workspace
   * @param alias - Alias name to remove
   * @returns true if alias was removed, false if it didn't exist
   * @throws {ValidationError} If the workspace doesn't exist
   */
  removeAlias(workspaceName: string, alias: string): boolean {
    const ws = this.config.workspaces[workspaceName];
    if (!ws) {
      throw new ValidationError(`Workspace '${workspaceName}' does not exist`);
    }

    if (!ws.aliases[alias]) {
      return false;
    }

    delete ws.aliases[alias];
    this.save();
    return true;
  }

  /**
   * Gets the effective configuration with precedence applied.
   * 
   * Configuration precedence (highest to lowest):
   * 1. CLI flags (cliFlags parameter)
   * 2. Workspace config (active workspace)
   * 3. Global settings (config.settings)
   * 4. Default values (DEFAULT_SETTINGS)
   * 
   * @param cliFlags - Optional CLI flag overrides for settings
   * @returns Object containing workspace config and effective settings
   */
  getEffectiveConfig(cliFlags: Partial<GlobalSettings> = {}): {
    workspace?: WorkspaceConfig;
    settings: GlobalSettings;
  } {
    const workspace = this.getActiveWorkspace();

    // Apply env var overrides (higher priority than workspace, lower than CLI flags)
    const effectiveWorkspace = this.applyEnvVarOverrides(workspace);

    // Apply precedence: CLI flags > global settings > defaults
    const settings: GlobalSettings = {
      ...DEFAULT_SETTINGS,
      ...this.config.settings,
      ...cliFlags,
    };

    return { workspace: effectiveWorkspace, settings };
  }

  /**
   * Applies environment variable overrides to workspace configuration.
   * 
   * Supported environment variables:
   * - `NOCO_BASE_URL` — overrides the workspace base URL
   * - `NOCO_TOKEN` — overrides the `xc-token` header
   * - `NOCO_BASE_ID` — overrides the default base ID
   * 
   * If no workspace exists but env vars provide enough info (at minimum
   * `NOCO_BASE_URL`), an ephemeral workspace is created from env vars alone.
   * 
   * @param workspace - Current workspace configuration (may be undefined)
   * @returns Workspace configuration with env var overrides applied
   */
  private applyEnvVarOverrides(workspace?: WorkspaceConfig): WorkspaceConfig | undefined {
    const envBaseUrl = process.env.NOCO_BASE_URL;
    const envToken = process.env.NOCO_TOKEN;
    const envBaseId = process.env.NOCO_BASE_ID;
    const envWorkspaceId = process.env.NOCO_WORKSPACE_ID;

    // No env vars set — return workspace as-is
    if (!envBaseUrl && !envToken && !envBaseId && !envWorkspaceId) {
      return workspace;
    }

    // If no workspace exists, create an ephemeral one from env vars
    if (!workspace) {
      if (!envBaseUrl) {
        return undefined;
      }
      return {
        baseUrl: envBaseUrl,
        headers: envToken ? { "xc-token": envToken } : {},
        baseId: envBaseId,
        workspaceId: envWorkspaceId,
        aliases: {},
      };
    }

    // Overlay env vars onto existing workspace (env vars win)
    return {
      ...workspace,
      baseUrl: envBaseUrl ?? workspace.baseUrl,
      headers: envToken
        ? { ...workspace.headers, "xc-token": envToken }
        : workspace.headers,
      baseId: envBaseId ?? workspace.baseId,
      workspaceId: envWorkspaceId ?? workspace.workspaceId,
    };
  }

  /**
   * Updates global settings.
   * 
   * This method validates the settings before saving.
   * 
   * @param settings - Partial settings to update
   * @throws {ValidationError} If the settings are invalid
   */
  updateSettings(settings: Partial<GlobalSettings>): void {
    const newSettings = {
      ...this.config.settings,
      ...settings,
    };

    // Validate settings
    this.validateGlobalSettings(newSettings);

    this.config.settings = newSettings;
    this.save();
  }

  /**
   * Gets the current global settings.
   * 
   * @returns Current global settings
   */
  getSettings(): GlobalSettings {
    return { ...this.config.settings };
  }

  /**
   * Validates workspace configuration.
   * 
   * @param config - Workspace configuration to validate
   * @throws {ValidationError} If the configuration is invalid
   */
  private validateWorkspaceConfig(config: WorkspaceConfig): void {
    // Validate baseUrl format
    if (!config.baseUrl) {
      throw new ValidationError("Workspace baseUrl is required");
    }

    try {
      const url = new URL(config.baseUrl);
      if (!url.protocol.startsWith("http")) {
        throw new ValidationError(
          `Invalid baseUrl protocol: ${url.protocol}. Must be http: or https:`
        );
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(`Invalid baseUrl format: ${config.baseUrl}`);
    }

    // Validate headers structure
    if (config.headers && typeof config.headers !== "object") {
      throw new ValidationError("Workspace headers must be an object");
    }

    // Validate aliases structure
    if (config.aliases && typeof config.aliases !== "object") {
      throw new ValidationError("Workspace aliases must be an object");
    }
  }

  /**
   * Validates global settings.
   * 
   * @param settings - Global settings to validate
   * @throws {ValidationError} If the settings are invalid
   */
  private validateGlobalSettings(settings: GlobalSettings): void {
    // Validate timeoutMs
    if (!Number.isFinite(settings.timeoutMs) || settings.timeoutMs <= 0) {
      throw new ValidationError(
        `Invalid timeoutMs: ${settings.timeoutMs}. Must be a positive finite number.`
      );
    }

    // Validate retryCount
    if (!Number.isFinite(settings.retryCount) || settings.retryCount < 0) {
      throw new ValidationError(
        `Invalid retryCount: ${settings.retryCount}. Must be a non-negative finite number.`
      );
    }

    // Validate retryDelay
    if (!Number.isFinite(settings.retryDelay) || settings.retryDelay < 0) {
      throw new ValidationError(
        `Invalid retryDelay: ${settings.retryDelay}. Must be a non-negative finite number.`
      );
    }

    // Validate retryStatusCodes
    if (!Array.isArray(settings.retryStatusCodes)) {
      throw new ValidationError("retryStatusCodes must be an array");
    }

    for (const code of settings.retryStatusCodes) {
      if (!Number.isInteger(code) || code < 100 || code > 599) {
        throw new ValidationError(
          `Invalid HTTP status code in retryStatusCodes: ${code}`
        );
      }
    }
  }

  /**
   * Saves the configuration to disk atomically.
   * 
   * This method writes to a temporary file first, then renames it to ensure
   * atomic updates and prevent corruption from partial writes.
   * 
   * @param config - Optional configuration to save (defaults to current config)
   */
  private save(config = this.config): void {
    // Ensure config directory exists
    fs.mkdirSync(this.configDir, { recursive: true });

    // Write to temporary file first for atomic update
    const tempPath = `${this.configPath}.tmp`;
    const backupPath = `${this.configPath}.bak`;
    const content = JSON.stringify(config, null, 2);

    // Write and flush to disk
    fs.writeFileSync(tempPath, content, { encoding: "utf8", flag: "w" });

    // Verify temp file was created and has content
    if (!fs.existsSync(tempPath)) {
      throw new Error(`Failed to create temporary config file at ${tempPath}`);
    }

    const stats = fs.statSync(tempPath);
    if (stats.size === 0) {
      throw new Error(`Temporary config file at ${tempPath} is empty`);
    }

    // On Windows, rename fails if target exists.
    // Create a backup first so we can recover if the process crashes
    // between unlink and rename.
    if (fs.existsSync(this.configPath)) {
      try {
        fs.copyFileSync(this.configPath, backupPath);
      } catch {
        // Best-effort backup
      }

      // Retry loop for the unlink+rename to handle transient locks on Windows
      let renamed = false;
      for (let attempt = 0; attempt < 3 && !renamed; attempt++) {
        try {
          // Only unlink if the target still exists (may have been
          // removed by a previous attempt that failed on rename).
          if (fs.existsSync(this.configPath)) {
            fs.unlinkSync(this.configPath);
          }
          fs.renameSync(tempPath, this.configPath);
          renamed = true;
        } catch {
          // Synchronous sleep before retry to let file locks release.
          // Atomics.wait is the most efficient synchronous delay in
          // Node.js — it blocks without burning CPU (unlike a spin
          // loop) and without spawning a child process.
          if (attempt < 2) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
          }
        }
      }

      if (!renamed) {
        // Clean up orphaned temp file
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        // Last resort: restore from backup and throw
        if (fs.existsSync(backupPath) && !fs.existsSync(this.configPath)) {
          fs.copyFileSync(backupPath, this.configPath);
        }
        throw new Error(`Failed to save config to ${this.configPath} after retries`);
      }

      // Clean up backup on success
      try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
    } else {
      // No existing file, just rename
      fs.renameSync(tempPath, this.configPath);
    }
  }

  /**
   * Gets the configuration directory path.
   * 
   * @returns Configuration directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Gets the configuration file path.
   * 
   * @returns Configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
