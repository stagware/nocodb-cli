import fs from "node:fs";
import path from "node:path";
import { getSettingsDir } from "./settings.js";

export type AliasMap = Record<string, string>;

export interface WorkspaceConfig {
  baseUrl: string;
  headers: Record<string, string>;
  baseId?: string;
  aliases: AliasMap;
}

export type MultiConfig = Record<string, WorkspaceConfig>;

export function getAliasesPath(): string {
  return path.join(getSettingsDir(), "config.v2.json");
}

export function loadMultiConfig(): MultiConfig {
  try {
    const raw = fs.readFileSync(getAliasesPath(), "utf8");
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
    // file missing or corrupt — use empty
  }
  return {};
}

export function saveMultiConfig(config: MultiConfig): void {
  const dir = getSettingsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getAliasesPath(), JSON.stringify(config, null, 2), "utf8");
}

/**
 * Resolves an alias within a specific workspace context.
 * Format: [workspace].[alias]
 */
export function resolveNamespacedAlias(
  input: string,
  config: MultiConfig,
  currentWorkspace?: string
): { id: string; workspace?: WorkspaceConfig } {
  // 1. Check for explicit namespace (e.g. work.tasks)
  const firstDotIndex = input.indexOf(".");
  if (firstDotIndex !== -1) {
    const wsName = input.slice(0, firstDotIndex);
    const aliasName = input.slice(firstDotIndex + 1);
    if (wsName && aliasName) {
      const ws = config[wsName];
      if (ws && ws.aliases[aliasName]) {
        return { id: ws.aliases[aliasName], workspace: ws };
      }
    }
  }

  // 2. Check current workspace context
  if (currentWorkspace && config[currentWorkspace]) {
    const ws = config[currentWorkspace];
    if (ws.aliases[input]) {
      return { id: ws.aliases[input], workspace: ws };
    }
  }

  // 3. Check for workspace-level alias (e.g. "kb" -> baseId)
  if (config[input] && config[input].baseId) {
    return { id: config[input].baseId!, workspace: config[input] };
  }

  return { id: input };
}
