import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NocoClient } from "@nocodb/sdk";

vi.mock("@nocodb/sdk", () => {
  const request = vi.fn();
  
  class ValidationError extends Error {
    constructor(message: string, public fieldErrors?: Record<string, string[]>) {
      super(message);
      this.name = "ValidationError";
    }
  }
  
  return {
    NocoClient: vi.fn().mockImplementation(() => ({
      request,
    })),
    MetaApi: vi.fn().mockImplementation(() => ({
      getBaseSwagger: vi.fn().mockResolvedValue({
        paths: {
          "/api/v2/tables/table1/records": {
            post: { operationId: "create" },
            patch: { operationId: "update" },
          },
        },
      }),
    })),
    ValidationError,
  };
});

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

describe("rows bulk-upsert command", () => {
  let client: { request: ReturnType<typeof vi.fn> };
  let configDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = { request: vi.fn() };
    vi.mocked(NocoClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => client as never);

    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-upsert-"));
    process.env.NOCO_QUIET = "1";
    await runCli(["config", "set", "baseUrl", "http://localhost"], configDir);
  });

  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    try {
      fs.rmSync(configDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("handles existing rows and creates/updates correctly", async () => {
    client.request.mockResolvedValueOnce({
      list: [
        { Id: 1, Email: "a@ex.com", Name: "A" },
        { Id: 2, Email: "b@ex.com", Name: "B" },
      ],
      pageInfo: { totalRows: 2 },
    });
    client.request.mockResolvedValueOnce({ created: true });
    client.request.mockResolvedValueOnce({ updated: true });

    const incoming = [
      { Email: "a@ex.com", Name: "A-updated" },
      { Email: "c@ex.com", Name: "C-new" },
    ];

    await runCli(
      [
        "--base",
        "b1",
        "rows",
        "bulk-upsert",
        "table1",
        "--match",
        "Email",
        "--data",
        JSON.stringify(incoming),
      ],
      configDir,
    );

    expect(client.request).toHaveBeenCalledTimes(3);
    expect(client.request).toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("records"),
      expect.objectContaining({
        body: [{ Email: "c@ex.com", Name: "C-new" }],
      }),
    );
    expect(client.request).toHaveBeenCalledWith(
      "PATCH",
      expect.stringContaining("records"),
      expect.objectContaining({
        body: [{ Email: "a@ex.com", Name: "A-updated", Id: 1 }],
      }),
    );
  });

  it("fails on non-unique matches", async () => {
    client.request.mockResolvedValueOnce({
      list: [
        { Id: 1, Email: "dup@ex.com" },
        { Id: 2, Email: "dup@ex.com" },
      ],
      pageInfo: { totalRows: 2 },
    });

    const incoming = [{ Email: "dup@ex.com", Name: "Fail" }];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCli(
      [
        "--base",
        "b1",
        "rows",
        "bulk-upsert",
        "table1",
        "--match",
        "Email",
        "--data",
        JSON.stringify(incoming),
      ],
      configDir,
    );

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Multiple rows matched"));
    consoleSpy.mockRestore();
  });
});
