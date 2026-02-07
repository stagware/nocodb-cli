import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (!chunks.length) { resolve(undefined); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function startServer() {
  const calls: Array<{ method: string; path: string; query: string; body: unknown }> = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const body = await readJson(req);
    calls.push({ method: req.method ?? "", path: url.pathname, query: url.search, body });

    if (url.pathname === "/api/v2/tables/t1/links/f1/records/r1") {
      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ list: [{ Id: 10 }, { Id: 20 }], pageInfo: { totalRows: 2 } }));
        return;
      }
      if (req.method === "POST") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ msg: "Links created" }));
        return;
      }
      if (req.method === "DELETE") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ msg: "Links deleted" }));
        return;
      }
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

async function runCli(args: string[], configDir: string) {
  process.env.NOCO_CONFIG_DIR = configDir;
  process.argv = ["node", "nocodb", ...args];
  vi.resetModules();
  const mod = await import("../src/index.js");
  await mod.bootstrap();
}

describe("links create and delete commands", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("links create posts link body to the correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-links-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli([
        "links", "create", "t1", "f1", "r1",
        "--data", '[{"Id":100},{"Id":200}]',
        "--pretty",
      ], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/tables/t1/links/f1/records/r1");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual([{ Id: 100 }, { Id: 200 }]);

      const output = logs.join("\n");
      expect(output).toContain("Links created");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("links delete sends delete body to the correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-links-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli([
        "links", "delete", "t1", "f1", "r1",
        "--data", '[{"Id":10}]',
        "--pretty",
      ], configDir);

      const deleteCall = calls.find((c) => c.method === "DELETE" && c.path === "/api/v2/tables/t1/links/f1/records/r1");
      expect(deleteCall).toBeDefined();
      expect(deleteCall?.body).toEqual([{ Id: 10 }]);

      const output = logs.join("\n");
      expect(output).toContain("Links deleted");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });
});
