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

function startServer(initialRows: Row[] = []) {
  const rows: Row[] = [...initialRows];
  const calls: Array<{ method: string; path: string; query: string; body: unknown }> = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // Swagger endpoint
    if (url.pathname === "/api/v2/meta/bases/b1/swagger.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        paths: {
          "/api/v2/tables/t1/records": {
            get: { tags: ["Rows"], operationId: "rows-list" },
            post: { tags: ["Rows"], operationId: "rows-create" },
            patch: { tags: ["Rows"], operationId: "rows-update" },
            delete: { tags: ["Rows"], operationId: "rows-delete" },
          },
        },
      }));
      return;
    }

    // Single record read: GET /api/v2/tables/t1/records/:id
    const singleMatch = url.pathname.match(/^\/api\/v2\/tables\/t1\/records\/(\d+)$/);
    if (singleMatch && req.method === "GET") {
      const id = Number(singleMatch[1]);
      const row = rows.find((r) => r.Id === id);
      calls.push({ method: "GET", path: url.pathname, query: url.search, body: undefined });
      if (row) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(row));
      } else {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
      }
      return;
    }

    // Records endpoint
    if (url.pathname === "/api/v2/tables/t1/records") {
      const body = await readJson(req);
      calls.push({ method: req.method ?? "", path: url.pathname, query: url.search, body });

      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ list: rows, pageInfo: { totalRows: rows.length } }));
        return;
      }
      if (req.method === "POST") {
        const nextId = rows.length ? Math.max(...rows.map((r) => r.Id)) + 1 : 1;
        const created = { ...(body as Record<string, unknown>), Id: nextId } as Row;
        rows.push(created);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(created));
        return;
      }
      if (req.method === "PATCH") {
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
      if (req.method === "DELETE") {
        const id = Number((body as Record<string, unknown>)?.Id);
        const idx = rows.findIndex((r) => r.Id === id);
        if (idx !== -1) rows.splice(idx, 1);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ Id: id }));
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
    calls: typeof calls;
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

describe("rows single-row CRUD commands", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("rows list returns rows from the server", async () => {
    const { server, baseUrl, calls } = await startServer([
      { Id: 1, Email: "a@ex.com", Name: "Alice" },
      { Id: 2, Email: "b@ex.com", Name: "Bob" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["rows", "list", "t1", "--pretty"], configDir);

      const listCall = calls.find((c) => c.method === "GET" && c.path === "/api/v2/tables/t1/records");
      expect(listCall).toBeDefined();

      const output = logs.join("\n");
      expect(output).toContain("Alice");
      expect(output).toContain("Bob");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("rows list passes query parameters", async () => {
    const { server, baseUrl, calls } = await startServer([]);
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-list-q-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["rows", "list", "t1", "--query", "limit=5", "--query", "offset=10"], configDir);

      const listCall = calls.find((c) => c.method === "GET" && c.path === "/api/v2/tables/t1/records");
      expect(listCall).toBeDefined();
      expect(listCall?.query).toContain("limit=5");
      expect(listCall?.query).toContain("offset=10");
    } finally {
      server.close();
    }
  });

  it("rows read fetches a single record by id", async () => {
    const { server, baseUrl, calls } = await startServer([
      { Id: 42, Email: "test@ex.com", Name: "TestUser" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-read-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["rows", "read", "t1", "42", "--pretty"], configDir);

      const readCall = calls.find((c) => c.method === "GET" && c.path === "/api/v2/tables/t1/records/42");
      expect(readCall).toBeDefined();

      const output = logs.join("\n");
      expect(output).toContain("TestUser");
      expect(output).toContain("42");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("rows create posts a new row", async () => {
    const { server, baseUrl, rows, calls } = await startServer([]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli([
        "--base", "b1", "rows", "create", "t1",
        "--data", '{"Email":"new@ex.com","Name":"NewUser"}',
        "--pretty",
      ], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/tables/t1/records");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ Email: "new@ex.com", Name: "NewUser" });

      expect(rows).toHaveLength(1);
      expect(rows[0].Name).toBe("NewUser");

      const output = logs.join("\n");
      expect(output).toContain("NewUser");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("rows create reads body from --data-file", async () => {
    const { server, baseUrl, rows } = await startServer([]);
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-create-file-"));
      const dataFile = path.join(configDir, "row.json");
      fs.writeFileSync(dataFile, '{"Email":"file@ex.com","Name":"FileUser"}');

      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "create", "t1",
        "--data-file", dataFile,
      ], configDir);

      expect(rows).toHaveLength(1);
      expect(rows[0].Name).toBe("FileUser");
    } finally {
      server.close();
    }
  });

  it("rows update patches an existing row", async () => {
    const { server, baseUrl, rows, calls } = await startServer([
      { Id: 1, Email: "a@ex.com", Name: "Before" },
    ]);

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "update", "t1",
        "--data", '{"Id":1,"Name":"After"}',
      ], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/tables/t1/records");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ Id: 1, Name: "After" });

      expect(rows[0].Name).toBe("After");
    } finally {
      server.close();
    }
  });

  it("rows delete removes a row", async () => {
    const { server, baseUrl, rows, calls } = await startServer([
      { Id: 1, Email: "a@ex.com", Name: "Alice" },
      { Id: 2, Email: "b@ex.com", Name: "Bob" },
    ]);

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-rows-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli([
        "--base", "b1", "rows", "delete", "t1",
        "--data", '{"Id":1}',
      ], configDir);

      const deleteCall = calls.find((c) => c.method === "DELETE" && c.path === "/api/v2/tables/t1/records");
      expect(deleteCall).toBeDefined();
      expect(deleteCall?.body).toEqual({ Id: 1 });

      expect(rows).toHaveLength(1);
      expect(rows[0].Id).toBe(2);
    } finally {
      server.close();
    }
  });
});
