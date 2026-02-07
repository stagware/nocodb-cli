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
      if (!chunks.length) { resolve(undefined); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (err) { reject(err); }
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
      res.end(JSON.stringify({
        paths: {
          "/api/v2/tables/t1/records": {
            post: { tags: ["Rows"], operationId: "rows-create" },
            patch: { tags: ["Rows"], operationId: "rows-update" },
          },
        },
      }));
      return;
    }

    if (req.url?.startsWith("/api/v2/tables/t1/records")) {
      if (req.method === "GET") {
        counters.get += 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ list: rows, pageInfo: { totalRows: rows.length } }));
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
    counters: typeof counters;
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

describe("rows upsert --create-only / --update-only flags", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("--create-only succeeds when no match exists", async () => {
    const { server, baseUrl, rows, counters } = await startServer([]);
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-co-ok-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=new@ex.com",
        "--create-only",
        "--data", '{"Email":"new@ex.com","Name":"New"}',
      ], configDir);

      expect(rows).toHaveLength(1);
      expect(rows[0].Name).toBe("New");
      expect(counters.post).toBe(1);
      expect(counters.patch).toBe(0);
    } finally {
      server.close();
    }
  });

  it("--create-only fails when a match exists", async () => {
    const { server, baseUrl, counters } = await startServer([
      { Id: 1, Email: "exists@ex.com", Name: "Existing" },
    ]);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (msg?: unknown) => { errors.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-co-fail-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.exitCode = 0;

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=exists@ex.com",
        "--create-only",
        "--data", '{"Email":"exists@ex.com","Name":"Updated"}',
      ], configDir);

      expect(process.exitCode).toBe(1);
      expect(errors.join("\n")).toContain("already exists");
      expect(counters.post).toBe(0);
      expect(counters.patch).toBe(0);
    } finally {
      console.error = originalError;
      server.close();
    }
  });

  it("--update-only succeeds when a match exists", async () => {
    const { server, baseUrl, rows, counters } = await startServer([
      { Id: 1, Email: "exists@ex.com", Name: "Before" },
    ]);
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-uo-ok-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=exists@ex.com",
        "--update-only",
        "--data", '{"Email":"exists@ex.com","Name":"After"}',
      ], configDir);

      expect(rows).toHaveLength(1);
      expect(rows[0].Name).toBe("After");
      expect(counters.post).toBe(0);
      expect(counters.patch).toBe(1);
    } finally {
      server.close();
    }
  });

  it("--update-only fails when no match exists", async () => {
    const { server, baseUrl, counters } = await startServer([]);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (msg?: unknown) => { errors.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-upsert-uo-fail-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.exitCode = 0;

      await runCli([
        "--base", "b1", "rows", "upsert", "t1",
        "--match", "Email=missing@ex.com",
        "--update-only",
        "--data", '{"Email":"missing@ex.com","Name":"Nope"}',
      ], configDir);

      expect(process.exitCode).toBe(1);
      expect(errors.join("\n")).toMatch(/not found/i);
      expect(counters.post).toBe(0);
      expect(counters.patch).toBe(0);
    } finally {
      console.error = originalError;
      server.close();
    }
  });
});
