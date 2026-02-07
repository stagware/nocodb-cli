/**
 * Workspace and alias command handlers for configuration management.
 * 
 * This module provides CLI commands for managing workspaces and aliases:
 * - Workspace management (add, use, list, delete, show)
 * - Alias management (set, list, delete, clear)
 * 
 * @module commands/workspace-alias
 */

import { Command } from "commander";
import type { Container } from "../container.js";
import type { ConfigManager } from "../config/manager.js";
import { handleError } from "../utils/command-utils.js";

/**
 * Registers workspace and alias commands with the CLI program
 * @param program - Commander program instance
 * @param container - Dependency injection container
 */
export function registerWorkspaceAliasCommands(program: Command, container: Container): void {
  const configManager = container.get<ConfigManager>("configManager");

  // Workspace commands
  const workspaceCmd = program.command("workspace").description("Manage NocoDB workspaces (URL, Token, BaseID)");

  // Add workspace command
  workspaceCmd
    .command("add")
    .argument("name", "Workspace name (alias)")
    .argument("url", "Base URL")
    .argument("token", "API Token (xc-token)")
    .option("--base <id>", "Default Base ID for this workspace")
    .action((name: string, url: string, token: string, options: { base?: string }) => {
      try {
        configManager.addWorkspace(name, {
          baseUrl: url,
          headers: { "xc-token": token },
          baseId: options.base,
          aliases: {},
        });
        console.log(`Workspace '${name}' added.`);
      } catch (err) {
        handleError(err);
      }
    });

  // Use workspace command
  workspaceCmd
    .command("use")
    .argument("name", "Workspace name")
    .action((name: string) => {
      try {
        configManager.setActiveWorkspace(name);
        console.log(`Switched to workspace '${name}'.`);
      } catch (err) {
        handleError(err);
      }
    });

  // List workspaces command
  workspaceCmd
    .command("list")
    .action(() => {
      try {
        const workspaces = configManager.listWorkspaces();
        const activeWorkspace = configManager.getActiveWorkspace();
        const activeWorkspaceName = workspaces.find(
          (name) => configManager.getWorkspace(name) === activeWorkspace
        );

        for (const name of workspaces) {
          const ws = configManager.getWorkspace(name);
          const marker = name === activeWorkspaceName ? "* " : "  ";
          console.log(`${marker}${name} (${ws?.baseUrl || ""})`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Delete workspace command
  workspaceCmd
    .command("delete")
    .argument("name", "Workspace name")
    .action((name: string) => {
      try {
        const removed = configManager.removeWorkspace(name);
        if (!removed) {
          console.error(`Workspace '${name}' not found.`);
          process.exit(1);
        }
        console.log(`Workspace '${name}' deleted.`);
      } catch (err) {
        handleError(err);
      }
    });

  // Show workspace command
  workspaceCmd
    .command("show")
    .argument("[name]", "Workspace name")
    .action((name?: string) => {
      try {
        let workspace;
        let workspaceName = name;

        if (name) {
          workspace = configManager.getWorkspace(name);
        } else {
          workspace = configManager.getActiveWorkspace();
          // Find the name of the active workspace
          const workspaces = configManager.listWorkspaces();
          workspaceName = workspaces.find(
            (wsName) => configManager.getWorkspace(wsName) === workspace
          );
        }

        if (!workspace) {
          console.error("Workspace not found.");
          process.exit(1);
        }

        console.log(JSON.stringify(workspace, null, 2));
      } catch (err) {
        handleError(err);
      }
    });

  // Alias commands
  const aliasCmd = program.command("alias").description("Manage ID aliases (Namespaced)");

  // Set alias command
  aliasCmd
    .command("set")
    .argument("name", "Alias name (can be workspace.alias or just alias)")
    .argument("id", "Original ID")
    .action((name: string, id: string) => {
      try {
        let targetWs: string | undefined;
        let aliasName = name;

        // Check for workspace.alias format
        const dotIndex = name.indexOf(".");
        if (dotIndex !== -1) {
          const wsPart = name.slice(0, dotIndex);
          const aliasPart = name.slice(dotIndex + 1);

          if (!wsPart || !aliasPart) {
            console.error("Invalid alias format. Use 'workspace.alias' with non-empty workspace and alias names.");
            process.exit(1);
          }

          targetWs = wsPart;
          aliasName = aliasPart;
        } else {
          // Use active workspace
          const activeWorkspace = configManager.getActiveWorkspace();
          if (!activeWorkspace) {
            console.error("No active workspace. Use: nocodb workspace use <name> or specify workspace.alias");
            process.exit(1);
          }

          // Find the name of the active workspace
          const workspaces = configManager.listWorkspaces();
          targetWs = workspaces.find(
            (wsName) => configManager.getWorkspace(wsName) === activeWorkspace
          );

          if (!targetWs) {
            console.error("Active workspace not found.");
            process.exit(1);
          }
        }

        if (!aliasName) {
          console.error("Alias name cannot be empty.");
          process.exit(1);
        }

        configManager.setAlias(targetWs, aliasName, id);
        console.log(`Alias '${targetWs}.${aliasName}' set to ${id}`);
      } catch (err) {
        handleError(err);
      }
    });

  // List aliases command
  aliasCmd
    .command("list")
    .argument("[workspace]", "Workspace name")
    .action((wsName?: string) => {
      try {
        let workspace;
        let workspaceName = wsName;

        if (wsName) {
          workspace = configManager.getWorkspace(wsName);
          if (!workspace) {
            console.error(`Workspace '${wsName}' not found.`);
            process.exit(1);
          }
        } else {
          workspace = configManager.getActiveWorkspace();
          if (!workspace) {
            console.error("No active workspace. Use: nocodb workspace use <name> or specify a workspace name.");
            process.exit(1);
          }

          // Find the name of the active workspace
          const workspaces = configManager.listWorkspaces();
          workspaceName = workspaces.find(
            (name) => configManager.getWorkspace(name) === workspace
          );
        }

        console.log(JSON.stringify(workspace.aliases, null, 2));
      } catch (err) {
        handleError(err);
      }
    });

  // Delete alias command
  aliasCmd
    .command("delete")
    .argument("name", "Alias name (can be workspace.alias or just alias)")
    .action((name: string) => {
      try {
        let targetWs: string | undefined;
        let aliasName = name;

        // Check for workspace.alias format
        const dotIndex = name.indexOf(".");
        if (dotIndex !== -1) {
          const wsPart = name.slice(0, dotIndex);
          const aliasPart = name.slice(dotIndex + 1);

          if (!wsPart || !aliasPart) {
            console.error("Invalid alias format. Use 'workspace.alias' with non-empty workspace and alias names.");
            process.exit(1);
          }

          targetWs = wsPart;
          aliasName = aliasPart;
        } else {
          // Use active workspace
          const activeWorkspace = configManager.getActiveWorkspace();
          if (!activeWorkspace) {
            console.error("No active workspace. Use: nocodb workspace use <name> or specify workspace.alias");
            process.exit(1);
          }

          // Find the name of the active workspace
          const workspaces = configManager.listWorkspaces();
          targetWs = workspaces.find(
            (wsName) => configManager.getWorkspace(wsName) === activeWorkspace
          );

          if (!targetWs) {
            console.error("Active workspace not found.");
            process.exit(1);
          }
        }

        const removed = configManager.removeAlias(targetWs, aliasName);
        if (!removed) {
          console.error(`Alias '${targetWs}.${aliasName}' not found.`);
          process.exit(1);
        }

        console.log(`Alias '${targetWs}.${aliasName}' deleted.`);
      } catch (err) {
        handleError(err);
      }
    });

  // Clear aliases command
  aliasCmd
    .command("clear")
    .argument("[workspace]", "Workspace name")
    .action((wsName?: string) => {
      try {
        let workspace;
        let workspaceName = wsName;

        if (wsName) {
          workspace = configManager.getWorkspace(wsName);
          if (!workspace) {
            console.error(`Workspace '${wsName}' not found.`);
            process.exit(1);
          }
          workspaceName = wsName;
        } else {
          workspace = configManager.getActiveWorkspace();
          if (!workspace) {
            console.error("No active workspace.");
            process.exit(1);
          }

          // Find the name of the active workspace
          const workspaces = configManager.listWorkspaces();
          workspaceName = workspaces.find(
            (name) => configManager.getWorkspace(name) === workspace
          );
        }

        // Clear all aliases by setting to empty object
        workspace.aliases = {};
        configManager.addWorkspace(workspaceName!, workspace);

        console.log(`All aliases cleared for workspace '${workspaceName}'.`);
      } catch (err) {
        handleError(err);
      }
    });
}
