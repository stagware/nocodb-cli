import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface Settings {
  timeoutMs: number;
  retryCount: number;
  retryDelay: number;
  retryStatusCodes: number[];
}

export const DEFAULT_SETTINGS: Settings = {
  timeoutMs: 30000,
  retryCount: 3,
  retryDelay: 300,
  retryStatusCodes: [408, 409, 425, 429, 500, 502, 503, 504],
};

export function getSettingsDir(): string {
  const envDir = process.env.NOCODB_SETTINGS_DIR;
  if (envDir) return envDir;
  return path.join(os.homedir(), ".nocodb-cli");
}

export function getSettingsPath(): string {
  return path.join(getSettingsDir(), "settings.json");
}

export function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // file missing or corrupt — use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  const dir = getSettingsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

export function resetSettings(): void {
  saveSettings({ ...DEFAULT_SETTINGS });
}
