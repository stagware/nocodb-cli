import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Row = { Id: number; Name?: string; Email?: string };

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

    // Swagger endpoint (needed by RowService for validation)
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

    // Records endpoint
    if (url.pathname === "/api/v2/tables/t1/records") {
      const body = await readJson(req);
      calls.push({ method: req.method ?? "", path: url.pathname, query: url.search, body });

      if (req.method === "GET") {
        const limit = Number(url.searchParams.get("limit")) || 1000;
        const offset = Number(url.searchParams.get("offset")) || 0;
        const slice = rows.slice(offset, offset + limit);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          list: slice,
          pageInfo: { totalRows: rows.length, page: 1, pageSize: limit },
        }));
        return;
      }
      if (req.method === "POST") {
        if (Array.isArray(body)) {
          const created: Row[] = [];
          for (const item of body) {
            const nextId = rows.length ? Math.max(...rows.map((r) => r.Id)) + 1 : 1;
            const row = { ...(item as Record<string, unknown>), Id: nextId } as Row;
            rows.push(row);
            created.push(row);
          }
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ created: created.length }));
          return;
        }
        const nextId = rows.length ? Math.max(...rows.map((r) => r.Id)) + 1 : 1;
        const created = { ...(body as Record<string, unknown>), Id: nextId } as Row;
        rows.push(created);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(created));
        return;
      }
      if (req.method === "PATCH") {
        if (Array.isArray(body)) {
          let updatedCount = 0;
          for (const item of body) {
            const rec = item as Record<string, unknown>;
            const id = Number(rec.Id ?? rec.id);
            const idx = rows.findIndex((r) => r.Id === id);
            if (idx !== -1) {
              rows[idx] = { ...rows[idx], ...rec } as Row;
              updatedCount++;
            }
          }
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ updated: updatedCount }));
          return;
        }
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise<{ baseUrl: string; server: http.Server; calls: typeof calls; rows: typeof rows }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ baseUrl: `http://127.0.0.1:${addr.port}`, server, calls, rows });
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

describe("data export/import commands", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("data export writes JSON to stdout", async () => {
    const { server, baseUrl, calls } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
      { Id: 2, Name: "Bob", Email: "bob@example.com" },
      { Id: 3, Name: "Charlie", Email: "charlie@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-json-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["data", "export", "t1"], configDir);

      const output = logs.join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].Name).toBe("Alice");
      expect(parsed[2].Name).toBe("Charlie");
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("data export writes CSV to stdout", async () => {
    const { server, baseUrl } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
      { Id: 2, Name: "Bob", Email: "bob@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-csv-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["data", "export", "t1", "--format", "csv"], configDir);

      const output = logs.join("\n");
      const lines = output.trim().split("\n");
      expect(lines[0]).toContain("Id");
      expect(lines[0]).toContain("Name");
      expect(lines[0]).toContain("Email");
      expect(lines).toHaveLength(3); // header + 2 rows
    } finally {
      console.log = originalLog;
      server.close();
    }
  });

  it("data export writes JSON file with --out", async () => {
    const { server, baseUrl } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
      { Id: 2, Name: "Bob", Email: "bob@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-file-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-filecfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const outFile = path.join(tempDir, "export.json");
      await runCli(["data", "export", "t1", "--out", outFile], configDir);

      expect(logs.join("\n")).toContain("Exported 2 rows");
      const content = JSON.parse(fs.readFileSync(outFile, "utf8"));
      expect(content).toHaveLength(2);
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data export writes CSV file inferred from .csv extension", async () => {
    const { server, baseUrl } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-csvfile-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-export-csvfilecfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const outFile = path.join(tempDir, "export.csv");
      await runCli(["data", "export", "t1", "--out", outFile], configDir);

      expect(logs.join("\n")).toContain("Exported 1 rows");
      const content = fs.readFileSync(outFile, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2); // header + 1 row
      expect(lines[0]).toContain("Name");
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import reads JSON file and bulk-creates rows", async () => {
    const { server, baseUrl, rows } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-json-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-jsoncfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "import.json");
      fs.writeFileSync(importFile, JSON.stringify([
        { Name: "Dave", Email: "dave@example.com" },
        { Name: "Eve", Email: "eve@example.com" },
      ]));

      await runCli(["--base", "b1", "data", "import", "t1", importFile], configDir);

      expect(logs.join("\n")).toContain("Imported 2 rows");
      expect(rows).toHaveLength(3); // 1 initial + 2 imported
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import reads CSV file and bulk-creates rows", async () => {
    const { server, baseUrl, rows } = await startServer([]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-csv-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-csvcfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "import.csv");
      fs.writeFileSync(importFile, "Name,Email\nFrank,frank@example.com\nGrace,grace@example.com");

      await runCli(["--base", "b1", "data", "import", "t1", importFile], configDir);

      expect(logs.join("\n")).toContain("Imported 2 rows");
      expect(rows).toHaveLength(2);
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import handles single JSON object as one row", async () => {
    const { server, baseUrl, rows } = await startServer([]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-single-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-import-singlecfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "single.json");
      fs.writeFileSync(importFile, JSON.stringify({ Name: "Hank", Email: "hank@example.com" }));

      await runCli(["--base", "b1", "data", "import", "t1", importFile], configDir);

      expect(logs.join("\n")).toContain("Imported 1 rows");
      expect(rows).toHaveLength(1);
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import --match upserts: creates new and updates existing", async () => {
    const { server, baseUrl, rows } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
      { Id: 2, Name: "Bob", Email: "bob@example.com" },
    ]);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-upsert-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-upsertcfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "upsert.json");
      fs.writeFileSync(importFile, JSON.stringify([
        { Email: "alice@example.com", Name: "Alice Updated" },
        { Email: "charlie@example.com", Name: "Charlie New" },
      ]));

      await runCli(["--base", "b1", "data", "import", "t1", importFile, "--match", "Email"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("1 created");
      expect(output).toContain("1 updated");
      // Alice should be updated in place
      expect(rows.find((r) => r.Email === "alice@example.com")?.Name).toBe("Alice Updated");
      // Charlie should be newly created
      expect(rows).toHaveLength(3);
    } finally {
      console.log = originalLog;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import --match --create-only fails when match exists", async () => {
    const { server, baseUrl } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
    ]);
    const logs: string[] = [];
    const errors: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    console.error = (msg?: unknown) => { errors.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-createonly-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-createonlycfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "create-only.json");
      fs.writeFileSync(importFile, JSON.stringify([
        { Email: "alice@example.com", Name: "Alice Duplicate" },
      ]));

      await runCli(["--base", "b1", "data", "import", "t1", importFile, "--match", "Email", "--create-only"], configDir);

      const errOutput = errors.join("\n");
      expect(errOutput).toContain("already exists");
    } finally {
      console.log = originalLog;
      console.error = originalError;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("data import --match --update-only fails when no match exists", async () => {
    const { server, baseUrl } = await startServer([
      { Id: 1, Name: "Alice", Email: "alice@example.com" },
    ]);
    const logs: string[] = [];
    const errors: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
    console.error = (msg?: unknown) => { errors.push(String(msg ?? "")); };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-updateonly-"));

    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-data-updateonlycfg-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      const importFile = path.join(tempDir, "update-only.json");
      fs.writeFileSync(importFile, JSON.stringify([
        { Email: "nobody@example.com", Name: "Ghost" },
      ]));

      await runCli(["--base", "b1", "data", "import", "t1", importFile, "--match", "Email", "--update-only"], configDir);

      const errOutput = errors.join("\n");
      expect(errOutput).toContain("not found");
    } finally {
      console.log = originalLog;
      console.error = originalError;
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
