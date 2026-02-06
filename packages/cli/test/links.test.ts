import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

function makeConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-links-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.NOCO_CONFIG_DIR;
  vi.restoreAllMocks();
});

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.env.NOCO_QUIET = "1";
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

describe("links command", () => {
  it("registers links commands", async () => {
    const dir = makeConfigDir();
    // Just verify it doesn't crash and help works
    await runCli(["links", "--help"], dir);
  });
});
