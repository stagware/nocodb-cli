/**
 * Unified configuration manager for the NocoDB CLI.
 * 
 * This module consolidates the legacy config.ts, settings.ts, and aliases.ts
 * systems into a single, coherent configuration management system. It provides:
 * 
 * - Multi-workspace support with workspace-scoped configuration
 * - Automatic migration from legacy configuration files
 * - Clear configuration precedence rules
 * - Alias resolution with namespace support
 * - Configuration validation
 * 
 * @module config/manager
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Conf from "conf";
import { ValidationError } from "@nocodb/sdk";
import type { UnifiedConfig, WorkspaceConfig, GlobalSettings } from "./types.js";
import type { Settings } from "../settings.js";
import type { MultiConfig } from "../aliases.js";
import type { ConfigData } from "../config.js";

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
 * It automatically migrates legacy configuration files on first use.
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
   * The manager will load existing configuration or migrate from legacy files
   * if no unified configuration exists. The configuration directory can be
   * customized via the NOCODB_SETTINGS_DIR or NOCO_CONFIG_DIR environment variables.
   * 
   * @param configDir - Optional custom configuration directory path
   */
  constructor(configDir?: string) {
    this.configDir = this.resolveConfigDir(configDir);
    this.configPath = path.join(this.configDir, "config.json");
    this.config = this.loadOrMigrate();
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
   * Loads existing unified configuration or migrates from legacy files.
   * 
   * This method checks for the unified config.json file first. If not found,
   * it attempts to migrate from legacy configuration files (config.json via Conf,
   * settings.json, and config.v2.json for aliases).
   * 
   * @returns Loaded or migrated unified configuration
   */
  private loadOrMigrate(): UnifiedConfig {
    // Try loading unified config
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf8");
        const parsed = JSON.parse(raw) as UnifiedConfig;
        
        // Validate version
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
          return parsed;
        }
      } catch (err) {
        // Fall through to migration if parsing fails
        console.warn(`Warning: Failed to parse ${this.configPath}, attempting migration`);
      }
    }

    // Migrate from legacy config files
    return this.migrateFromLegacy();
  }

  /**
   * Migrates configuration from legacy files to unified format.
   * 
   * This method consolidates:
   * - Legacy config.json (Conf-based) -> default workspace or global config
   * - Legacy settings.json -> global settings
   * - Legacy config.v2.json (aliases) -> workspaces
   * 
   * The migration preserves all existing configuration values and creates
   * a default workspace if a legacy global config exists.
   * 
   * @returns Migrated unified configuration
   */
  private migrateFromLegacy(): UnifiedConfig {
    const legacyConfig = this.loadLegacyConfig();
    const legacySettings = this.loadLegacySettings();
    const legacyAliases = this.loadLegacyAliases();

    const unified: UnifiedConfig = {
      version: 2,
      workspaces: {},
      settings: legacySettings,
    };

    // Migrate workspace configs from aliases (config.v2.json)
    for (const [name, wsConfig] of Object.entries(legacyAliases)) {
      unified.workspaces[name] = {
        baseUrl: wsConfig.baseUrl,
        headers: wsConfig.headers || {},
        baseId: wsConfig.baseId,
        aliases: wsConfig.aliases || {},
      };
    }

    // Migrate legacy global config to default workspace if present
    if (legacyConfig.baseUrl) {
      // If there's already a 'default' workspace from aliases, merge with it
      if (unified.workspaces.default) {
        // Prefer legacy config values if they exist
        unified.workspaces.default.baseUrl = legacyConfig.baseUrl;
        if (legacyConfig.headers) {
          unified.workspaces.default.headers = {
            ...unified.workspaces.default.headers,
            ...legacyConfig.headers,
          };
        }
        if (legacyConfig.baseId) {
          unified.workspaces.default.baseId = legacyConfig.baseId;
        }
      } else {
        // Create new default workspace
        unified.workspaces.default = {
          baseUrl: legacyConfig.baseUrl,
          headers: legacyConfig.headers || {},
          baseId: legacyConfig.baseId,
          aliases: {},
        };
      }
      unified.activeWorkspace = "default";
    } else if (Object.keys(unified.workspaces).length > 0) {
      // Set first workspace as active if no default exists
      unified.activeWorkspace = Object.keys(unified.workspaces)[0];
    }

    // Save migrated config
    this.save(unified);
    
    return unified;
  }

  /**
   * Loads legacy Conf-based configuration (config.json).
   * 
   * This reads the old config.json file that was managed by the Conf library.
   * It contains global baseUrl, baseId, and headers.
   * 
   * @returns Legacy configuration data or empty object if not found
   */
  private loadLegacyConfig(): ConfigData {
    try {
      // Conf stores data in a specific location
      const conf = new Conf<ConfigData>({ 
        projectName: "nocodb", 
        cwd: this.configDir 
      });
      
      return {
        baseUrl: conf.get("baseUrl"),
        baseId: conf.get("baseId"),
        headers: conf.get("headers"),
      };
    } catch {
      return {};
    }
  }

  /**
   * Loads legacy settings.json file.
   * 
   * This reads the old settings.json file that contained timeout and retry
   * configuration. Returns default settings if file doesn't exist.
   * 
   * @returns Legacy settings or default settings
   */
  private loadLegacySettings(): GlobalSettings {
    try {
      const settingsPath = path.join(this.configDir, "settings.json");
      const raw = fs.readFileSync(settingsPath, "utf8");
      const parsed = JSON.parse(raw) as Settings;
      
      if (parsed && typeof parsed === "object") {
        return {
          timeoutMs: parsed.timeoutMs ?? DEFAULT_SETTINGS.timeoutMs,
          retryCount: parsed.retryCount ?? DEFAULT_SETTINGS.retryCount,
          retryDelay: parsed.retryDelay ?? DEFAULT_SETTINGS.retryDelay,
          retryStatusCodes: parsed.retryStatusCodes ?? DEFAULT_SETTINGS.retryStatusCodes,
        };
      }
    } catch {
      // File missing or corrupt — use defaults
    }
    
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Loads legacy config.v2.json file (workspace aliases).
   * 
   * This reads the old config.v2.json file that contained workspace-scoped
   * configurations and aliases. Returns empty object if file doesn't exist.
   * 
   * @returns Legacy workspace configurations or empty object
   */
  private loadLegacyAliases(): MultiConfig {
    try {
      const aliasesPath = path.join(this.configDir, "config.v2.json");
      const raw = fs.readFileSync(aliasesPath, "utf8");
      const parsed = JSON.parse(raw) as MultiConfig;
      
      if (parsed && typeof parsed === "object") {
        // Normalize entries to ensure required objects exist
        for (const name of Object.keys(parsed)) {
          if (!parsed[name].headers) parsed[name].headers = {};
          if (!parsed[name].aliases) parsed[name].aliases = {};
        }
        return parsed;
      }
    } catch {
      // File missing or corrupt — use empty
    }
    
    return {};
  }

  /**
   * Gets the currently active workspace configuration.
   * 
   * @returns Active workspace configuration or undefined if no workspace is active
   */
  getActiveWorkspace(): WorkspaceConfig | undefined {
    if (!this.config.activeWorkspace) return undefined;
    return this.config.workspaces[this.config.activeWorkspace];
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
    return this.config.workspaces[name];
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
   * 
   * @example
   * ```typescript
   * // Explicit namespace
   * resolveAlias('production.users')  // -> { id: 't123...', workspace: {...} }
   * 
   * // Active workspace alias
   * resolveAlias('users')  // -> { id: 't123...', workspace: {...} }
   * 
   * // Workspace-level alias
   * resolveAlias('production')  // -> { id: 'p456...', workspace: {...} }
   * 
   * // Pass-through UUID
   * resolveAlias('t1234567890abcdef')  // -> { id: 't1234567890abcdef' }
   * ```
   */
  resolveAlias(input: string): { id: string; workspace?: WorkspaceConfig } {
    // 1. Check for explicit namespace (workspace.alias)
    const dotIndex = input.indexOf(".");
    if (dotIndex !== -1) {
      const wsName = input.slice(0, dotIndex);
      const alias = input.slice(dotIndex + 1);
      const ws = this.config.workspaces[wsName];
      if (ws?.aliases[alias]) {
        return { id: ws.aliases[alias], workspace: ws };
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
      return { id: ws.baseId, workspace: ws };
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
   * 
   * @example
   * ```typescript
   * // Get effective config with CLI flag override
   * const { workspace, settings } = configManager.getEffectiveConfig({
   *   timeoutMs: 60000  // Override timeout to 60 seconds
   * });
   * 
   * console.log(settings.timeoutMs);  // 60000 (from CLI flag)
   * console.log(settings.retryCount);  // 3 (from global settings or default)
   * ```
   */
  getEffectiveConfig(cliFlags: Partial<GlobalSettings> = {}): {
    workspace?: WorkspaceConfig;
    settings: GlobalSettings;
  } {
    const workspace = this.getActiveWorkspace();
    
    // Apply precedence: CLI flags > global settings > defaults
    const settings: GlobalSettings = {
      ...DEFAULT_SETTINGS,
      ...this.config.settings,
      ...cliFlags,
    };
    
    return { workspace, settings };
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
    if (settings.timeoutMs <= 0) {
      throw new ValidationError(
        `Invalid timeoutMs: ${settings.timeoutMs}. Must be positive.`
      );
    }
    
    // Validate retryCount
    if (settings.retryCount < 0) {
      throw new ValidationError(
        `Invalid retryCount: ${settings.retryCount}. Must be non-negative.`
      );
    }
    
    // Validate retryDelay
    if (settings.retryDelay < 0) {
      throw new ValidationError(
        `Invalid retryDelay: ${settings.retryDelay}. Must be non-negative.`
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
          fs.unlinkSync(this.configPath);
          fs.renameSync(tempPath, this.configPath);
          renamed = true;
        } catch {
          // Brief pause before retry to let file locks release
          if (attempt < 2) {
            const start = Date.now();
            while (Date.now() - start < 50) { /* spin wait */ }
          }
        }
      }
      
      if (!renamed) {
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
