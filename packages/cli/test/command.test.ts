import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../src/config.js";

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
    const config = createConfig(dir);
    expect(config.get("baseUrl")).toBe("http://example.test");
    expect(config.get("baseId")).toBe("base-123");
  });

  it("sets headers", async () => {
    const dir = makeConfigDir();
    await runCli(["header", "set", "xc-token", "secret"], dir);
    const config = createConfig(dir);
    expect(config.get("headers")).toEqual({ "xc-token": "secret" });
  });
});
