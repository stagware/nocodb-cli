import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../src/config/manager.js";

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

function startServer() {
  const calls: Array<{ method: string; path: string; query: string }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    calls.push({ method: req.method ?? "", path: url.pathname, query: url.search });

    if (url.pathname === "/api/v2/tables/t1111111111111111/records") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ Id: 1, Name: "AliasRow" }], pageInfo: { totalRows: 1 } }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise<{ server: http.Server; baseUrl: string; calls: typeof calls }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, calls });
    });
  });
}

describe("workspace e2e via full CLI bootstrap", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("workspace add + use + list round-trip", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-roundtrip-"));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "dev", "http://dev.test", "dev-token", "--base", "b-dev"], configDir);
      await runCli(["workspace", "add", "prod", "http://prod.test", "prod-token"], configDir);
      await runCli(["workspace", "use", "prod"], configDir);

      process.env.NOCO_QUIET = "0";
      logs.length = 0;
      await runCli(["workspace", "list"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("dev");
      expect(output).toContain("prod");
      // Active workspace should be marked with *
      expect(output).toContain("* prod");
    } finally {
      console.log = originalLog;
    }
  });

  it("workspace show displays active workspace details", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-show-"));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "myws", "http://myws.test", "myws-token", "--base", "b-myws"], configDir);
      await runCli(["workspace", "use", "myws"], configDir);

      process.env.NOCO_QUIET = "0";
      logs.length = 0;
      await runCli(["workspace", "show"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("http://myws.test");
      expect(output).toContain("myws-token");
    } finally {
      console.log = originalLog;
    }
  });

  it("workspace show <name> displays named workspace", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-show-named-"));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "alpha", "http://alpha.test", "alpha-token"], configDir);
      await runCli(["workspace", "add", "beta", "http://beta.test", "beta-token"], configDir);

      process.env.NOCO_QUIET = "0";
      logs.length = 0;
      await runCli(["workspace", "show", "alpha"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("http://alpha.test");
    } finally {
      console.log = originalLog;
    }
  });

  it("workspace delete removes workspace", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-delete-"));
    process.env.NOCO_QUIET = "1";
    await runCli(["workspace", "add", "temp", "http://temp.test", "temp-token"], configDir);
    await runCli(["workspace", "delete", "temp"], configDir);

    process.env.NOCO_CONFIG_DIR = configDir;
    const cm = new ConfigManager();
    expect(cm.getWorkspace("temp")).toBeUndefined();
  });
});

describe("alias e2e via full CLI bootstrap", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("alias set + list round-trip", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-alias-roundtrip-"));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "dev", "http://dev.test", "dev-token"], configDir);
      await runCli(["workspace", "use", "dev"], configDir);
      await runCli(["alias", "set", "users", "t1111111111111111"], configDir);
      await runCli(["alias", "set", "tasks", "t2222222222222222"], configDir);

      process.env.NOCO_QUIET = "0";
      logs.length = 0;
      await runCli(["alias", "list"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("users");
      expect(output).toContain("t1111111111111111");
      expect(output).toContain("tasks");
      expect(output).toContain("t2222222222222222");
    } finally {
      console.log = originalLog;
    }
  });

  it("alias set with workspace.alias format", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-alias-ns-"));
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "prod", "http://prod.test", "prod-token"], configDir);

      process.env.NOCO_QUIET = "0";
      logs.length = 0;
      await runCli(["alias", "set", "prod.orders", "t9999999999999999"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("prod.orders");
      expect(output).toContain("t9999999999999999");

      // Verify via ConfigManager
      process.env.NOCO_CONFIG_DIR = configDir;
      const cm = new ConfigManager();
      const ws = cm.getWorkspace("prod");
      expect(ws?.aliases?.orders).toBe("t9999999999999999");
    } finally {
      console.log = originalLog;
    }
  });

  it("alias delete removes alias", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-alias-delete-"));
    process.env.NOCO_QUIET = "1";
    await runCli(["workspace", "add", "dev", "http://dev.test", "dev-token"], configDir);
    await runCli(["workspace", "use", "dev"], configDir);
    await runCli(["alias", "set", "users", "t1111111111111111"], configDir);
    await runCli(["alias", "delete", "users"], configDir);

    process.env.NOCO_CONFIG_DIR = configDir;
    const cm = new ConfigManager();
    const ws = cm.getWorkspace("dev");
    expect(ws?.aliases?.users).toBeUndefined();
  });

  it("alias clear removes all aliases", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-alias-clear-"));
    process.env.NOCO_QUIET = "1";
    await runCli(["workspace", "add", "dev", "http://dev.test", "dev-token"], configDir);
    await runCli(["workspace", "use", "dev"], configDir);
    await runCli(["alias", "set", "users", "t1111111111111111"], configDir);
    await runCli(["alias", "set", "tasks", "t2222222222222222"], configDir);
    await runCli(["alias", "clear"], configDir);

    process.env.NOCO_CONFIG_DIR = configDir;
    const cm = new ConfigManager();
    const ws = cm.getWorkspace("dev");
    expect(Object.keys(ws?.aliases || {})).toHaveLength(0);
  });

  it("alias resolves when used in rows list command", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-alias-resolve-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["workspace", "add", "dev", baseUrl, "dev-token"], configDir);
      await runCli(["workspace", "use", "dev"], configDir);
      await runCli(["alias", "set", "users", "t1111111111111111"], configDir);

      await runCli(["rows", "list", "users"], configDir);

      const listCall = calls.find((c) => c.method === "GET" && c.path === "/api/v2/tables/t1111111111111111/records");
      expect(listCall).toBeDefined();
    } finally {
      server.close();
    }
  });
});
