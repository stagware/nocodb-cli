import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const listLinksMock = vi.fn().mockResolvedValue({ ok: true, list: [] });

vi.mock("@nocodb/sdk", () => {
  class NocoClient {
    constructor(_: unknown) {}
  }

  class DataApi {
    constructor(_: unknown) {}
    listLinks = listLinksMock;
    linkRecords = vi.fn();
    unlinkRecords = vi.fn();
  }

  class MetaApi {
    constructor(_: unknown) {}
  }

  return {
    NocoClient,
    DataApi,
    MetaApi,
    parseHeader: (input: string) => {
      const idx = input.indexOf(":");
      if (idx === -1) {
        throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
      }
      const name = input.slice(0, idx).trim();
      const value = input.slice(idx + 1).trim();
      if (!name || !value) {
        throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
      }
      return [name, value] as [string, string];
    },
  };
});

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
  delete process.env.NOCO_QUIET;
  listLinksMock.mockClear();
  vi.restoreAllMocks();
});

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

describe("links command", () => {
  it("calls DataApi.listLinks with parsed query params", async () => {
    const dir = makeConfigDir();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", "http://example.test"], dir);
      process.env.NOCO_QUIET = "0";

      await runCli(["links", "list", "t1", "f1", "r1", "--query", "limit=10", "--pretty"], dir);

      expect(listLinksMock).toHaveBeenCalledWith("t1", "f1", "r1", { limit: "10" });
      const output = logs.find((line) => line.includes("\"ok\""));
      expect(output ?? "").toContain("\"ok\": true");
    } finally {
      console.log = originalLog;
    }
  });
});
