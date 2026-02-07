/**
 * Integration tests for command handlers
 * 
 * These tests verify command registration, workspace/alias management,
 * and error handling patterns.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { createTestContainer } from "../src/container.js";
import { ConfigManager } from "../src/config/manager.js";
import { registerWorkspaceAliasCommands } from "../src/commands/workspace-alias.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("Command Integration Tests", () => {
  let testConfigDir: string;
  let configManager: ConfigManager;
  let container: ReturnType<typeof createTestContainer>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create temporary config directory
    testConfigDir = path.join(os.tmpdir(), `nocodb-cli-test-${Date.now()}`);
    fs.mkdirSync(testConfigDir, { recursive: true });

    // Create config manager with test directory
    configManager = new ConfigManager(testConfigDir);
    configManager.addWorkspace("test", {
      baseUrl: "https://test.nocodb.com",
      headers: { "xc-token": "test-token" },
      baseId: "p1234567890abcdef",
      aliases: {
        users: "t1111111111111111",
        tasks: "t2222222222222222",
      },
    });
    configManager.setActiveWorkspace("test");

    // Create test container
    container = createTestContainer({
      configManager,
    });

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  describe("Workspace Commands", () => {
    it("should add workspace", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync([
          "workspace",
          "add",
          "production",
          "https://prod.nocodb.com",
          "prod-token",
        ], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith("Workspace 'production' added.");

      const workspace = configManager.getWorkspace("production");
      expect(workspace).toBeDefined();
      expect(workspace?.baseUrl).toBe("https://prod.nocodb.com");
    });

    it("should switch workspace", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      configManager.addWorkspace("staging", {
        baseUrl: "https://staging.nocodb.com",
        headers: { "xc-token": "staging-token" },
        aliases: {},
      });

      try {
        await program.parseAsync(["workspace", "use", "staging"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith("Switched to workspace 'staging'.");

      const activeWorkspace = configManager.getActiveWorkspace();
      expect(activeWorkspace?.baseUrl).toBe("https://staging.nocodb.com");
    });

    it("should list workspaces", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["workspace", "list"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should delete workspace", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      configManager.addWorkspace("temp", {
        baseUrl: "https://temp.nocodb.com",
        headers: { "xc-token": "temp-token" },
        aliases: {},
      });

      try {
        await program.parseAsync(["workspace", "delete", "temp"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith("Workspace 'temp' deleted.");

      const workspace = configManager.getWorkspace("temp");
      expect(workspace).toBeUndefined();
    });

    it("should show workspace details", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["workspace", "show"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("test.nocodb.com");
    });
  });

  describe("Alias Commands", () => {
    it("should set alias", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync([
          "alias",
          "set",
          "projects",
          "t3333333333333333",
        ], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Alias 'test.projects' set to t3333333333333333"
      );

      const { id } = configManager.resolveAlias("projects");
      expect(id).toBe("t3333333333333333");
    });

    it("should list aliases", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["alias", "list"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("users");
      expect(output).toContain("tasks");
    });

    it("should delete alias", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["alias", "delete", "users"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith("Alias 'test.users' deleted.");

      const { id } = configManager.resolveAlias("users");
      expect(id).toBe("users"); // Should return input as-is when not found
    });

    it("should clear all aliases", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["alias", "clear"], { from: "user" });
      } catch (err) {
        // Commander throws on exit, ignore
      }

      expect(consoleLogSpy).toHaveBeenCalledWith("All aliases cleared for workspace 'test'.");

      const workspace = configManager.getActiveWorkspace();
      expect(Object.keys(workspace?.aliases || {})).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing workspace errors", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["workspace", "use", "nonexistent"], { from: "user" });
      } catch (err) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(4); // ValidationError exit code
    });

    it("should handle workspace deletion of non-existent workspace", async () => {
      const program = new Command();
      program.exitOverride();
      registerWorkspaceAliasCommands(program, container);

      try {
        await program.parseAsync(["workspace", "delete", "nonexistent"], { from: "user" });
      } catch (err) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("ConfigManager Integration", () => {
    it("should resolve aliases correctly", () => {
      const { id, workspace } = configManager.resolveAlias("users");
      expect(id).toBe("t1111111111111111");
      expect(workspace?.baseUrl).toBe("https://test.nocodb.com");
    });

    it("should resolve namespaced aliases", () => {
      configManager.addWorkspace("prod", {
        baseUrl: "https://prod.nocodb.com",
        headers: { "xc-token": "prod-token" },
        aliases: { users: "t9999999999999999" },
      });

      const { id, workspace } = configManager.resolveAlias("prod.users");
      expect(id).toBe("t9999999999999999");
      expect(workspace?.baseUrl).toBe("https://prod.nocodb.com");
    });

    it("should pass through UUIDs when no alias found", () => {
      const { id } = configManager.resolveAlias("t1234567890abcdef");
      expect(id).toBe("t1234567890abcdef");
    });
  });
});

