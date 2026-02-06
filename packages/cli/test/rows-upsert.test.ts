import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Row = { Id: number; Email?: string; Name?: string };

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
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

function startServer(initialRows: Row[]) {
  const rows: Row[] = [...initialRows];
  const counters = { get: 0, post: 0, patch: 0 };

  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/v2/meta/bases/b1/swagger.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          paths: {
            "/api/v2/tables/t1/records": {
              post: { tags: ["Rows"], operationId: "rows-create" },
              patch: { tags: ["Rows"], operationId: "rows-update" },
            },
          },
        })
      );
      return;
    }

    if (req.url?.startsWith("/api/v2/tables/t1/records")) {
      if (req.method === "GET") {
        counters.get += 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ list: rows, pageInfo: {} }));
        return;
      }
      if (req.method === "POST") {
        counters.post += 1;
        const body = await readJson(req);
        const nextId = rows.length ? Math.max(...rows.map((r) => r.Id)) + 1 : 1;
        const created = { ...(body as Record<string, unknown>), Id: nextId } as Row;
        rows.push(created);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(created));
        return;
      }
      if (req.method === "PATCH") {
        counters.patch += 1;
        const body = await readJson(req);
        const id = Number((body as Record<string, unknown>)?.Id);
        const idx = rows.findIndex((r) => r.Id === id);
        if (idx === -1) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
          return;
        }
        rows[idx] = { ...rows[idx], ...(body as Record<string, unknown>) };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(rows[idx]));
        return;
      }
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise<{
    server: http.Server;
    baseUrl: string;
    rows: Row[];
    counters: { get: number; post: number; patch: number };
  }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, rows, counters });
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

describe("rows upsert command", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("creates when no row matches", async () => {
    const { server, baseUrl, rows, counters } = await startServer([]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=alice@example.com",
        "--data", "{\"Email\":\"alice@example.com\",\"Name\":\"Alice\"}",
        "--pretty",
      ], configDir);

      expect(rows).toHaveLength(1);
      expect(rows[0].Name).toBe("Alice");
      expect(counters.post).toBe(1);
      expect(counters.patch).toBe(0);
      const output = logs.find((line) => line.includes("\"Id\""));
      expect(output ?? "").toContain("\"Id\": 1");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("updates when one row matches", async () => {
    const { server, rows, counters, baseUrl } = await startServer([{ Id: 1, Email: "alice@example.com", Name: "Before" }]);
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=alice@example.com",
        "--data", "{\"Email\":\"alice@example.com\",\"Name\":\"After\"}",
      ], configDir);

      expect(rows).toHaveLength(1);
      expect(rows[0].Id).toBe(1);
      expect(rows[0].Name).toBe("After");
      expect(counters.post).toBe(0);
      expect(counters.patch).toBe(1);
    } finally {
      server.close();
    }
  });

  it("fails when multiple rows match", async () => {
    const { server, baseUrl, counters } = await startServer([
      { Id: 1, Email: "dup@example.com", Name: "One" },
      { Id: 2, Email: "dup@example.com", Name: "Two" },
    ]);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ""));
    };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-ambiguous-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.exitCode = 0;

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=dup@example.com",
        "--data", "{\"Email\":\"dup@example.com\",\"Name\":\"Updated\"}",
      ], configDir);

      expect(process.exitCode).toBe(1);
      expect(errors.join("\n")).toContain("Multiple rows matched");
      expect(counters.post).toBe(0);
      expect(counters.patch).toBe(0);
    } finally {
      console.error = originalError;
      server.close();
    }
  });
});
