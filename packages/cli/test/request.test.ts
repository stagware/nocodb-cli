import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/v2/meta/bases")) {
      const url = new URL(req.url, "http://localhost");
      const echoed = url.searchParams.get("q");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, q: echoed }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
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

describe("cli request command", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
  });

  it("sends raw requests with query parameters", async () => {
    const { server, baseUrl } = await startServer();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-request-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";
      await runCli(["request", "GET", "/api/v2/meta/bases", "--query", "q=hello", "--pretty"], configDir);
      const output = logs.find((line) => line.includes("\"ok\""));
      expect(output ?? "").toContain("\"ok\": true");
      expect(output ?? "").toContain("\"q\": \"hello\"");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });
});
