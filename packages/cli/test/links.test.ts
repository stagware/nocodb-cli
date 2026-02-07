import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function startServer() {
  const calls: Array<{ method: string; path: string; query: string }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    calls.push({
      method: req.method ?? "",
      path: url.pathname,
      query: url.search,
    });

    if (url.pathname === "/api/v2/tables/t1/links/f1/records/r1") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, list: [] }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise<{ server: http.Server; baseUrl: string; calls: Array<{ method: string; path: string; query: string }> }>((resolve) => {
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

describe("links command", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("calls listLinks endpoint with parsed query params", async () => {
    const { server, baseUrl, calls } = await startServer();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-links-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["links", "list", "t1", "f1", "r1", "--query", "limit=10", "--pretty"], configDir);

      const linksCall = calls.find(c => c.path === "/api/v2/tables/t1/links/f1/records/r1");
      expect(linksCall).toBeDefined();
      expect(linksCall?.query).toContain("limit=10");
      
      const output = logs.find((line) => line.includes("\"ok\""));
      expect(output ?? "").toContain("\"ok\": true");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });
});
