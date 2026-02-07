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
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function startServer() {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/v2/meta/bases/b1/swagger.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          paths: {
            "/api/v2/tables/t1/records": {
              post: { tags: ["Rows"], operationId: "rows-create" },
              patch: { tags: ["Rows"], operationId: "rows-update" },
              delete: { tags: ["Rows"], operationId: "rows-delete" },
            },
          },
        })
      );
      return;
    }

    if (req.url?.startsWith("/api/v2/tables/t1/records")) {
      const body = await readJson(req);
      calls.push({
        method: req.method ?? "",
        path: req.url.split("?")[0] ?? "",
        body,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise<{ server: http.Server; baseUrl: string; calls: Array<{ method: string; path: string; body: unknown }> }>((resolve) => {
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

describe("rows bulk commands", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("bulk-create posts array payload to records endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "bulk-create", "t1",
        "--data", "[{\"Email\":\"a@example.com\"},{\"Email\":\"b@example.com\"}]",
        "--fail-fast",  // Use fail-fast mode to send as single bulk request
      ], configDir);

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const recordsCall = calls.find(c => c.method === "POST" && c.path === "/api/v2/tables/t1/records");
      expect(recordsCall).toBeDefined();
      expect(recordsCall?.body).toEqual([{ Email: "a@example.com" }, { Email: "b@example.com" }]);
    } finally {
      server.close();
    }
  });

  it("bulk-update patches array payload to records endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "bulk-update", "t1",
        "--data", "[{\"Id\":1,\"Name\":\"A\"},{\"Id\":2,\"Name\":\"B\"}]",
        "--fail-fast",  // Use fail-fast mode to send as single bulk request
      ], configDir);

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const recordsCall = calls.find(c => c.method === "PATCH" && c.path === "/api/v2/tables/t1/records");
      expect(recordsCall).toBeDefined();
      expect(recordsCall?.body).toEqual([{ Id: 1, Name: "A" }, { Id: 2, Name: "B" }]);
    } finally {
      server.close();
    }
  });

  it("bulk-delete sends array payload to records endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "bulk-delete", "t1",
        "--data", "[{\"Id\":1},{\"Id\":2}]",
        "--fail-fast",  // Use fail-fast mode to send as single bulk request
      ], configDir);

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const recordsCall = calls.find(c => c.method === "DELETE" && c.path === "/api/v2/tables/t1/records");
      expect(recordsCall).toBeDefined();
      expect(recordsCall?.body).toEqual([{ Id: 1 }, { Id: 2 }]);
    } finally {
      server.close();
    }
  });
});
