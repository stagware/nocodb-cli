/**
 * Unit tests for ConfigManager class.
 * 
 * Tests cover:
 * - Configuration loading
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
import { ValidationError } from "@stagware/nocodb-sdk";
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

  describe("env var overrides", () => {
    afterEach(() => {
      // Restore original env vars
      delete process.env.NOCO_BASE_URL;
      delete process.env.NOCO_TOKEN;
      delete process.env.NOCO_BASE_ID;
      delete process.env.NOCO_WORKSPACE_ID;
    });

    it("should override workspace baseUrl with NOCO_BASE_URL", () => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://original.nocodb.com",
        headers: { "xc-token": "original-token" },
        aliases: {},
      });
      configManager.setActiveWorkspace("test");

      process.env.NOCO_BASE_URL = "https://env-override.nocodb.com";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace?.baseUrl).toBe("https://env-override.nocodb.com");
      // Token should remain from workspace
      expect(workspace?.headers["xc-token"]).toBe("original-token");
    });

    it("should override workspace token with NOCO_TOKEN", () => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://original.nocodb.com",
        headers: { "xc-token": "original-token" },
        aliases: {},
      });
      configManager.setActiveWorkspace("test");

      process.env.NOCO_TOKEN = "env-token";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace?.headers["xc-token"]).toBe("env-token");
      // baseUrl should remain from workspace
      expect(workspace?.baseUrl).toBe("https://original.nocodb.com");
    });

    it("should override workspace baseId with NOCO_BASE_ID", () => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://original.nocodb.com",
        headers: {},
        baseId: "original-base-id",
        aliases: {},
      });
      configManager.setActiveWorkspace("test");

      process.env.NOCO_BASE_ID = "env-base-id";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace?.baseId).toBe("env-base-id");
    });

    it("should create ephemeral workspace from env vars when no workspace exists", () => {
      configManager = new ConfigManager(tempDir);
      // No workspaces configured

      process.env.NOCO_BASE_URL = "https://ci.nocodb.com";
      process.env.NOCO_TOKEN = "ci-token";
      process.env.NOCO_BASE_ID = "ci-base-id";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace).toBeDefined();
      expect(workspace?.baseUrl).toBe("https://ci.nocodb.com");
      expect(workspace?.headers["xc-token"]).toBe("ci-token");
      expect(workspace?.baseId).toBe("ci-base-id");
    });

    it("should return undefined workspace when only NOCO_TOKEN is set without workspace", () => {
      configManager = new ConfigManager(tempDir);
      // No workspaces configured, no NOCO_BASE_URL

      process.env.NOCO_TOKEN = "ci-token";

      const { workspace } = configManager.getEffectiveConfig();
      // Cannot create ephemeral workspace without baseUrl
      expect(workspace).toBeUndefined();
    });

    it("should not modify workspace when no env vars are set", () => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://original.nocodb.com",
        headers: { "xc-token": "original-token" },
        baseId: "original-base-id",
        aliases: {},
      });
      configManager.setActiveWorkspace("test");

      // No env vars set
      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace?.baseUrl).toBe("https://original.nocodb.com");
      expect(workspace?.headers["xc-token"]).toBe("original-token");
      expect(workspace?.baseId).toBe("original-base-id");
    });

    it("should apply all three env vars simultaneously", () => {
      configManager = new ConfigManager(tempDir);
      configManager.addWorkspace("test", {
        baseUrl: "https://original.nocodb.com",
        headers: { "xc-token": "original-token", "x-custom": "keep-me" },
        baseId: "original-base-id",
        aliases: { users: "t123" },
      });
      configManager.setActiveWorkspace("test");

      process.env.NOCO_BASE_URL = "https://env.nocodb.com";
      process.env.NOCO_TOKEN = "env-token";
      process.env.NOCO_BASE_ID = "env-base-id";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace?.baseUrl).toBe("https://env.nocodb.com");
      expect(workspace?.headers["xc-token"]).toBe("env-token");
      expect(workspace?.headers["x-custom"]).toBe("keep-me");
      expect(workspace?.baseId).toBe("env-base-id");
      // Aliases should be preserved
      expect(workspace?.aliases?.users).toBe("t123");
    });

    it("should create ephemeral workspace with only NOCO_BASE_URL (no token)", () => {
      configManager = new ConfigManager(tempDir);

      process.env.NOCO_BASE_URL = "https://public.nocodb.com";

      const { workspace } = configManager.getEffectiveConfig();
      expect(workspace).toBeDefined();
      expect(workspace?.baseUrl).toBe("https://public.nocodb.com");
      expect(workspace?.headers).toEqual({});
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
