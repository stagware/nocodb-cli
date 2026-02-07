/**
 * Unit tests for ConfigManager class.
 * 
 * Tests cover:
 * - Configuration loading and migration
 * - Workspace management
 * - Alias resolution
 * - Configuration precedence
 * - Validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigManager, DEFAULT_SETTINGS } from "../src/config/manager.js";
import { ValidationError } from "@nocodb/sdk";
import type { UnifiedConfig, WorkspaceConfig } from "../src/config/types.js";

describe("ConfigManager", () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    // Create a temporary directory for test configs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("initialization", () => {
    it("should create a new config with defaults when no config exists", () => {
      configManager = new ConfigManager(tempDir);
      
      expect(configManager.listWorkspaces()).toEqual([]);
      expect(configManager.getActiveWorkspace()).toBeUndefined();
      expect(configManager.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it("should load existing unified config", () => {
      const config: UnifiedConfig = {
        version: 2,
        activeWorkspace: "test",
        workspaces: {
          test: {
            baseUrl: "https://test.nocodb.com",
            headers: { "xc-token": "test-token" },
            baseId: "p123",
            aliases: { users: "t456" },
          },
        },
        settings: DEFAULT_SETTINGS,
      };

      fs.writeFileSync(
        path.join(tempDir, "config.json"),
        JSON.stringify(config, null, 2)
      );

      configManager = new ConfigManager(tempDir);

      expect(configManager.getActiveWorkspace()).toEqual(config.workspaces.test);
      expect(configManager.listWorkspaces()).toEqual(["test"]);
    });
  });

  describe("workspace management", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);
    });

    it("should add a new workspace", () => {
      const workspace: WorkspaceConfig = {
        baseUrl: "https://app.nocodb.com",
        headers: { "xc-token": "token123" },
        baseId: "p123",
        aliases: {},
      };

      configManager.addWorkspace("production", workspace);

      expect(configManager.listWorkspaces()).toContain("production");
      expect(configManager.getWorkspace("production")).toEqual(workspace);
    });

    it("should set active workspace", () => {
      const workspace: WorkspaceConfig = {
        baseUrl: "https://app.nocodb.com",
        headers: { "xc-token": "token123" },
        aliases: {},
      };

      configManager.addWorkspace("production", workspace);
      configManager.setActiveWorkspace("production");

      expect(configManager.getActiveWorkspace()).toEqual(workspace);
    });

    it("should throw error when setting non-existent workspace as active", () => {
      expect(() => {
        configManager.setActiveWorkspace("nonexistent");
      }).toThrow(ValidationError);
    });

    it("should remove a workspace", () => {
      const workspace: WorkspaceConfig = {
        baseUrl: "https://app.nocodb.com",
        headers: {},
        aliases: {},
      };

      configManager.addWorkspace("test", workspace);
      expect(configManager.listWorkspaces()).toContain("test");

      const removed = configManager.removeWorkspace("test");
      expect(removed).toBe(true);
      expect(configManager.listWorkspaces()).not.toContain("test");
    });

    it("should clear active workspace when removing it", () => {
      const workspace: WorkspaceConfig = {
        baseUrl: "https://app.nocodb.com",
        headers: {},
        aliases: {},
      };

      configManager.addWorkspace("test", workspace);
      configManager.setActiveWorkspace("test");
      expect(configManager.getActiveWorkspace()).toBeDefined();

      configManager.removeWorkspace("test");
      expect(configManager.getActiveWorkspace()).toBeUndefined();
    });

    it("should return false when removing non-existent workspace", () => {
      const removed = configManager.removeWorkspace("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("alias resolution", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);

      // Set up test workspaces
      configManager.addWorkspace("production", {
        baseUrl: "https://prod.nocodb.com",
        headers: {},
        baseId: "p123",
        aliases: {
          users: "t456",
          posts: "t789",
        },
      });

      configManager.addWorkspace("staging", {
        baseUrl: "https://staging.nocodb.com",
        headers: {},
        baseId: "p999",
        aliases: {
          users: "t111",
          comments: "t222",
        },
      });

      configManager.setActiveWorkspace("production");
    });

    it("should resolve explicit namespace alias", () => {
      const result = configManager.resolveAlias("staging.users");
      
      expect(result.id).toBe("t111");
      expect(result.workspace?.baseUrl).toBe("https://staging.nocodb.com");
    });

    it("should resolve active workspace alias", () => {
      const result = configManager.resolveAlias("users");
      
      expect(result.id).toBe("t456");
      expect(result.workspace?.baseUrl).toBe("https://prod.nocodb.com");
    });

    it("should resolve workspace-level alias (workspace name to baseId)", () => {
      const result = configManager.resolveAlias("production");
      
      expect(result.id).toBe("p123");
      expect(result.workspace?.baseUrl).toBe("https://prod.nocodb.com");
    });

    it("should pass through UUID when no alias matches", () => {
      const result = configManager.resolveAlias("t1234567890abcdef");
      
      expect(result.id).toBe("t1234567890abcdef");
      expect(result.workspace).toBeUndefined();
    });

    it("should prefer explicit namespace over active workspace", () => {
      // Both workspaces have 'users' alias with different IDs
      const result = configManager.resolveAlias("staging.users");
      
      expect(result.id).toBe("t111"); // staging's users, not production's
    });
  });

  describe("alias management", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://test.nocodb.com",
        headers: {},
        aliases: {},
      });
    });

    it("should set an alias", () => {
      configManager.setAlias("test", "users", "t123");
      
      const workspace = configManager.getWorkspace("test");
      expect(workspace?.aliases.users).toBe("t123");
    });

    it("should update an existing alias", () => {
      configManager.setAlias("test", "users", "t123");
      configManager.setAlias("test", "users", "t456");
      
      const workspace = configManager.getWorkspace("test");
      expect(workspace?.aliases.users).toBe("t456");
    });

    it("should remove an alias", () => {
      configManager.setAlias("test", "users", "t123");
      
      const removed = configManager.removeAlias("test", "users");
      expect(removed).toBe(true);
      
      const workspace = configManager.getWorkspace("test");
      expect(workspace?.aliases.users).toBeUndefined();
    });

    it("should return false when removing non-existent alias", () => {
      const removed = configManager.removeAlias("test", "nonexistent");
      expect(removed).toBe(false);
    });

    it("should throw error when setting alias in non-existent workspace", () => {
      expect(() => {
        configManager.setAlias("nonexistent", "users", "t123");
      }).toThrow(ValidationError);
    });
  });

  describe("configuration precedence", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);
      
      // Set up workspace with custom settings
      configManager.addWorkspace("test", {
        baseUrl: "https://test.nocodb.com",
        headers: {},
        aliases: {},
      });
      configManager.setActiveWorkspace("test");
      
      // Set global settings
      configManager.updateSettings({
        timeoutMs: 60000,
        retryCount: 5,
      });
    });

    it("should use global settings when no CLI flags provided", () => {
      const { settings } = configManager.getEffectiveConfig();
      
      expect(settings.timeoutMs).toBe(60000);
      expect(settings.retryCount).toBe(5);
      expect(settings.retryDelay).toBe(DEFAULT_SETTINGS.retryDelay);
    });

    it("should override with CLI flags", () => {
      const { settings } = configManager.getEffectiveConfig({
        timeoutMs: 120000,
      });
      
      expect(settings.timeoutMs).toBe(120000); // CLI flag
      expect(settings.retryCount).toBe(5); // Global setting
    });

    it("should use defaults for unset values", () => {
      const { settings } = configManager.getEffectiveConfig();
      
      expect(settings.retryStatusCodes).toEqual(DEFAULT_SETTINGS.retryStatusCodes);
    });
  });

  describe("settings management", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);
    });

    it("should update global settings", () => {
      configManager.updateSettings({
        timeoutMs: 45000,
        retryCount: 2,
      });
      
      const settings = configManager.getSettings();
      expect(settings.timeoutMs).toBe(45000);
      expect(settings.retryCount).toBe(2);
      expect(settings.retryDelay).toBe(DEFAULT_SETTINGS.retryDelay);
    });

    it("should get current settings", () => {
      const settings = configManager.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      configManager = new ConfigManager(tempDir);
    });

    describe("workspace validation", () => {
      it("should reject workspace without baseUrl", () => {
        expect(() => {
          configManager.addWorkspace("test", {
            baseUrl: "",
            headers: {},
            aliases: {},
          });
        }).toThrow(ValidationError);
      });

      it("should reject workspace with invalid baseUrl", () => {
        expect(() => {
          configManager.addWorkspace("test", {
            baseUrl: "not-a-url",
            headers: {},
            aliases: {},
          });
        }).toThrow(ValidationError);
      });

      it("should reject workspace with non-http protocol", () => {
        expect(() => {
          configManager.addWorkspace("test", {
            baseUrl: "ftp://test.nocodb.com",
            headers: {},
            aliases: {},
          });
        }).toThrow(ValidationError);
      });

      it("should accept valid http and https URLs", () => {
        expect(() => {
          configManager.addWorkspace("test1", {
            baseUrl: "http://localhost:8080",
            headers: {},
            aliases: {},
          });
          configManager.addWorkspace("test2", {
            baseUrl: "https://app.nocodb.com",
            headers: {},
            aliases: {},
          });
        }).not.toThrow();
      });
    });

    describe("settings validation", () => {
      it("should reject negative timeout", () => {
        expect(() => {
          configManager.updateSettings({ timeoutMs: -1000 });
        }).toThrow(ValidationError);
      });

      it("should reject zero timeout", () => {
        expect(() => {
          configManager.updateSettings({ timeoutMs: 0 });
        }).toThrow(ValidationError);
      });

      it("should reject negative retry count", () => {
        expect(() => {
          configManager.updateSettings({ retryCount: -1 });
        }).toThrow(ValidationError);
      });

      it("should accept zero retry count (disables retries)", () => {
        expect(() => {
          configManager.updateSettings({ retryCount: 0 });
        }).not.toThrow();
      });

      it("should reject negative retry delay", () => {
        expect(() => {
          configManager.updateSettings({ retryDelay: -100 });
        }).toThrow(ValidationError);
      });

      it("should reject invalid status codes", () => {
        expect(() => {
          configManager.updateSettings({ retryStatusCodes: [99, 500] });
        }).toThrow(ValidationError);

        expect(() => {
          configManager.updateSettings({ retryStatusCodes: [600, 500] });
        }).toThrow(ValidationError);
      });

      it("should accept valid status codes", () => {
        expect(() => {
          configManager.updateSettings({ 
            retryStatusCodes: [408, 429, 500, 502, 503, 504] 
          });
        }).not.toThrow();
      });
    });
  });

  describe("legacy migration", () => {
    it("should migrate legacy config.json (Conf-based)", () => {
      // Create legacy Conf config
      const legacyConfigPath = path.join(tempDir, "config.json");
      const legacyConfig = {
        baseUrl: "https://legacy.nocodb.com",
        baseId: "p123",
        headers: { "xc-token": "legacy-token" },
      };
      
      // Conf stores data in a specific format
      fs.writeFileSync(
        legacyConfigPath,
        JSON.stringify(legacyConfig, null, 2)
      );

      configManager = new ConfigManager(tempDir);

      // Should create default workspace from legacy config
      const defaultWs = configManager.getWorkspace("default");
      expect(defaultWs).toBeDefined();
      expect(defaultWs?.baseUrl).toBe("https://legacy.nocodb.com");
      expect(defaultWs?.baseId).toBe("p123");
      expect(defaultWs?.headers["xc-token"]).toBe("legacy-token");
    });

    it("should migrate legacy settings.json", () => {
      const legacySettings = {
        timeoutMs: 45000,
        retryCount: 2,
        retryDelay: 500,
        retryStatusCodes: [500, 502, 503],
      };

      fs.writeFileSync(
        path.join(tempDir, "settings.json"),
        JSON.stringify(legacySettings, null, 2)
      );

      configManager = new ConfigManager(tempDir);

      const settings = configManager.getSettings();
      expect(settings.timeoutMs).toBe(45000);
      expect(settings.retryCount).toBe(2);
      expect(settings.retryDelay).toBe(500);
      expect(settings.retryStatusCodes).toEqual([500, 502, 503]);
    });

    it("should migrate legacy config.v2.json (aliases)", () => {
      const legacyAliases = {
        production: {
          baseUrl: "https://prod.nocodb.com",
          headers: { "xc-token": "prod-token" },
          baseId: "p123",
          aliases: { users: "t456" },
        },
        staging: {
          baseUrl: "https://staging.nocodb.com",
          headers: { "xc-token": "staging-token" },
          baseId: "p789",
          aliases: { users: "t111" },
        },
      };

      fs.writeFileSync(
        path.join(tempDir, "config.v2.json"),
        JSON.stringify(legacyAliases, null, 2)
      );

      configManager = new ConfigManager(tempDir);

      expect(configManager.listWorkspaces()).toContain("production");
      expect(configManager.listWorkspaces()).toContain("staging");

      const prodWs = configManager.getWorkspace("production");
      expect(prodWs?.baseUrl).toBe("https://prod.nocodb.com");
      expect(prodWs?.aliases.users).toBe("t456");
    });

    it("should merge legacy config with legacy aliases", () => {
      // Create legacy Conf config with 'default' workspace
      fs.writeFileSync(
        path.join(tempDir, "config.json"),
        JSON.stringify({
          baseUrl: "https://global.nocodb.com",
          headers: { "xc-token": "global-token" },
        }, null, 2)
      );

      // Create legacy aliases with 'default' workspace
      fs.writeFileSync(
        path.join(tempDir, "config.v2.json"),
        JSON.stringify({
          default: {
            baseUrl: "https://alias.nocodb.com",
            headers: {},
            aliases: { users: "t123" },
          },
        }, null, 2)
      );

      configManager = new ConfigManager(tempDir);

      const defaultWs = configManager.getWorkspace("default");
      // Legacy config should take precedence
      expect(defaultWs?.baseUrl).toBe("https://global.nocodb.com");
      expect(defaultWs?.headers["xc-token"]).toBe("global-token");
      // Aliases should be preserved
      expect(defaultWs?.aliases.users).toBe("t123");
    });
  });

  describe("persistence", () => {
    it("should persist configuration to disk", () => {
      configManager = new ConfigManager(tempDir);
      
      configManager.addWorkspace("test", {
        baseUrl: "https://test.nocodb.com",
        headers: { "xc-token": "test-token" },
        aliases: { users: "t123" },
      });

      // Create new instance to verify persistence
      const newManager = new ConfigManager(tempDir);
      
      const workspace = newManager.getWorkspace("test");
      expect(workspace).toBeDefined();
      expect(workspace?.baseUrl).toBe("https://test.nocodb.com");
      expect(workspace?.aliases.users).toBe("t123");
    });

    it("should use atomic writes", () => {
      configManager = new ConfigManager(tempDir);
      
      configManager.addWorkspace("test", {
        baseUrl: "https://test.nocodb.com",
        headers: {},
        aliases: {},
      });

      // Verify no .tmp file remains
      const tempFile = path.join(tempDir, "config.json.tmp");
      expect(fs.existsSync(tempFile)).toBe(false);
    });
  });

  describe("getConfigDir and getConfigPath", () => {
    it("should return correct config directory", () => {
      configManager = new ConfigManager(tempDir);
      expect(configManager.getConfigDir()).toBe(tempDir);
    });

    it("should return correct config file path", () => {
      configManager = new ConfigManager(tempDir);
      expect(configManager.getConfigPath()).toBe(path.join(tempDir, "config.json"));
    });
  });
});
