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
            },
          },
        })
      );
      return;
    }

    if (req.url?.startsWith("/api/v2/tables/t1/records")) {
      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ list: rows, pageInfo: {} }));
        return;
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        calls.push({ method: "POST", path: req.url.split("?")[0] ?? "", body });
        const arr = Array.isArray(body) ? body : [body];
        const nextId = rows.length ? Math.max(...rows.map((r) => r.Id)) + 1 : 1;
        for (let i = 0; i < arr.length; i++) {
          rows.push({ ...arr[i], Id: nextId + i } as Row);
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ created: arr.length }));
        return;
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        calls.push({ method: "PATCH", path: req.url.split("?")[0] ?? "", body });
        const arr = Array.isArray(body) ? body : [body];
        for (const item of arr) {
          const id = Number((item as Record<string, unknown>)?.Id);
          const idx = rows.findIndex((r) => r.Id === id);
          if (idx !== -1) {
            rows[idx] = { ...rows[idx], ...(item as Record<string, unknown>) } as Row;
          }
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ updated: arr.length }));
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
    calls: Array<{ method: string; path: string; body: unknown }>;
  }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, rows, calls });
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

describe("rows bulk-upsert command", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("handles existing rows and creates/updates correctly", async () => {
    const { server, baseUrl, rows, calls } = await startServer([
      { Id: 1, Email: "a@ex.com", Name: "A" },
      { Id: 2, Email: "b@ex.com", Name: "B" },
    ]);

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-upsert-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      const incoming = [
        { Email: "a@ex.com", Name: "A-updated" },
        { Email: "c@ex.com", Name: "C-new" },
      ];

      await runCli(
        [
          "--base", "b1", "rows", "bulk-upsert", "t1",
          "--match", "Email",
          "--data", JSON.stringify(incoming),
        ],
        configDir,
      );

      const postCall = calls.find((c) => c.method === "POST");
      const patchCall = calls.find((c) => c.method === "PATCH");

      expect(postCall).toBeDefined();
      expect(postCall?.body).toEqual([{ Email: "c@ex.com", Name: "C-new" }]);

      expect(patchCall).toBeDefined();
      expect(patchCall?.body).toEqual([{ Email: "a@ex.com", Name: "A-updated", Id: 1 }]);
    } finally {
      server.close();
    }
  });

  it("fails on non-unique matches", async () => {
    const { server, baseUrl, calls } = await startServer([
      { Id: 1, Email: "dup@ex.com" },
      { Id: 2, Email: "dup@ex.com" },
    ]);

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ""));
    };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bulk-upsert-dup-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.exitCode = 0;

      const incoming = [{ Email: "dup@ex.com", Name: "Fail" }];

      await runCli(
        [
          "--base", "b1", "rows", "bulk-upsert", "t1",
          "--match", "Email",
          "--data", JSON.stringify(incoming),
        ],
        configDir,
      );

      expect(errors.join("\n")).toContain("Multiple rows matched");
      expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
      expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    } finally {
      console.error = originalError;
      server.close();
    }
  });
});
