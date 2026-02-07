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
  const calls: Array<{ method: string; path: string; query: string; headers: Record<string, string | undefined>; body: unknown }> = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const body = await readJson(req);
    calls.push({
      method: req.method ?? "",
      path: url.pathname,
      query: url.search,
      headers: {
        "x-custom": req.headers["x-custom"] as string | undefined,
        "x-another": req.headers["x-another"] as string | undefined,
      },
      body,
    });

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, method: req.method, path: url.pathname }));
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

describe("request command extended e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("sends POST request with --data body", async () => {
    const { server, baseUrl, calls } = await startServer();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-req-body-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli([
        "request", "POST", "/api/v2/test",
        "--data", '{"title":"Hello"}',
        "--pretty",
      ], configDir);

      const postCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/test");
      expect(postCall).toBeDefined();
      expect(postCall?.body).toEqual({ title: "Hello" });

      const output = logs.join("\n");
      expect(output).toContain("\"ok\": true");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("sends request with custom headers", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-req-headers-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "request", "GET", "/api/v2/test",
        "--header", "x-custom: my-value",
        "--header", "x-another: second-value",
      ], configDir);

      const getCall = calls.find((c) => c.method === "GET" && c.path === "/api/v2/test");
      expect(getCall).toBeDefined();
      expect(getCall?.headers["x-custom"]).toBe("my-value");
      expect(getCall?.headers["x-another"]).toBe("second-value");
    } finally {
      server.close();
    }
  });

  it("sends request with --data-file body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-req-datafile-"));
      const dataFile = path.join(configDir, "body.json");
      fs.writeFileSync(dataFile, '{"from":"file"}');

      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "request", "PUT", "/api/v2/test",
        "--data-file", dataFile,
      ], configDir);

      const putCall = calls.find((c) => c.method === "PUT" && c.path === "/api/v2/test");
      expect(putCall).toBeDefined();
      expect(putCall?.body).toEqual({ from: "file" });
    } finally {
      server.close();
    }
  });

  it("sends request with multiple query params and body together", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-req-combo-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "request", "PATCH", "/api/v2/test",
        "--query", "limit=10",
        "--query", "offset=5",
        "--data", '{"status":"active"}',
        "--header", "x-custom: combo-test",
      ], configDir);

      const patchCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/test");
      expect(patchCall).toBeDefined();
      expect(patchCall?.query).toContain("limit=10");
      expect(patchCall?.query).toContain("offset=5");
      expect(patchCall?.body).toEqual({ status: "active" });
      expect(patchCall?.headers["x-custom"]).toBe("combo-test");
    } finally {
      server.close();
    }
  });
});
