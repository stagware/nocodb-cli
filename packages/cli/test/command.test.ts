import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../src/config/manager.js";

const tempDirs: string[] = [];

function makeConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cmd-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.NOCO_CONFIG_DIR;
});

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.env.NOCO_QUIET = "1";
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

describe("cli command parsing", () => {
  it("sets config values", async () => {
    const dir = makeConfigDir();
    await runCli(["config", "set", "baseUrl", "http://example.test"], dir);
    await runCli(["config", "set", "baseId", "base-123"], dir);
    
    // Check using ConfigManager (unified config)
    process.env.NOCO_CONFIG_DIR = dir;
    const configManager = new ConfigManager();
    const ws = configManager.getWorkspace("default");
    expect(ws?.baseUrl).toBe("http://example.test");
    expect(ws?.baseId).toBe("base-123");
  });

  it("sets headers", async () => {
    const dir = makeConfigDir();
    // Set baseUrl first (required for workspace)
    await runCli(["config", "set", "baseUrl", "http://example.test"], dir);
    await runCli(["header", "set", "xc-token", "secret"], dir);
    
    // Check using ConfigManager (unified config)
    process.env.NOCO_CONFIG_DIR = dir;
    const configManager = new ConfigManager();
    const ws = configManager.getWorkspace("default");
    expect(ws?.headers).toEqual({ "xc-token": "secret" });
  });
});
