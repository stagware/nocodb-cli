import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadSettings, saveSettings, resetSettings, getSettingsPath, DEFAULT_SETTINGS } from "../src/settings.js";

describe("settings", () => {
  let tmpDir: string;
  const origEnv = process.env.NOCODB_SETTINGS_DIR;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-settings-test-"));
    process.env.NOCODB_SETTINGS_DIR = tmpDir;
  });

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.NOCODB_SETTINGS_DIR;
    } else {
      process.env.NOCODB_SETTINGS_DIR = origEnv;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("returns defaults when settings file is missing", () => {
    const s = loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial file over defaults", () => {
    fs.writeFileSync(path.join(tmpDir, "settings.json"), JSON.stringify({ timeoutMs: 5000 }));
    const s = loadSettings();
    expect(s.timeoutMs).toBe(5000);
    expect(s.retryCount).toBe(DEFAULT_SETTINGS.retryCount);
    expect(s.retryDelay).toBe(DEFAULT_SETTINGS.retryDelay);
    expect(s.retryStatusCodes).toEqual(DEFAULT_SETTINGS.retryStatusCodes);
  });

  it("saveSettings creates dir and file", () => {
    const nestedDir = path.join(tmpDir, "sub");
    process.env.NOCODB_SETTINGS_DIR = nestedDir;
    const custom = { ...DEFAULT_SETTINGS, timeoutMs: 10000 };
    saveSettings(custom);
    const raw = fs.readFileSync(path.join(nestedDir, "settings.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.timeoutMs).toBe(10000);
  });

  it("resetSettings writes defaults", () => {
    saveSettings({ ...DEFAULT_SETTINGS, timeoutMs: 99999 });
    resetSettings();
    const s = loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("handles corrupt JSON gracefully", () => {
    fs.writeFileSync(path.join(tmpDir, "settings.json"), "not valid json {{{");
    const s = loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("getSettingsPath respects NOCODB_SETTINGS_DIR", () => {
    expect(getSettingsPath()).toBe(path.join(tmpDir, "settings.json"));
  });
});
