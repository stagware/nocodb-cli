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
  const calls: Array<{ method: string; path: string; body: unknown }> = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const body = await readJson(req);
    calls.push({ method: req.method ?? "", path: url.pathname, body });

    // --- Bases ---
    if (url.pathname === "/api/v2/meta/bases" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "b1", title: "Base1" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "b-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "b1", title: "Base1" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1/info" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "b1", info: true }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "b1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Tables ---
    if (url.pathname === "/api/v2/meta/bases/b1/tables" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "t1", title: "Table1" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1/tables" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "t-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/tables/t1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "t1", title: "Table1" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/tables/t1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "t1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/tables/t1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Views ---
    if (url.pathname === "/api/v2/meta/tables/t1/views" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "v1", title: "View1" }], pageInfo: {} }));
      return;
    }
    // NocoDB uses v2 type-specific endpoints for view creation (plural names)
    const viewCreateMatch = url.pathname.match(/^\/api\/v2\/meta\/tables\/([^/]+)\/(grids|forms|galleries|kanbans|calendars)$/);
    if (viewCreateMatch && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "v-new", type: viewCreateMatch[2], ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/views/v1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "v1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/views/v1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Columns ---
    if (url.pathname === "/api/v2/meta/tables/t1/columns" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "c1", title: "Col1" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/tables/t1/columns" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "c-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/columns/c1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "c1", title: "Col1" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/columns/c1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "c1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/columns/c1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Filters ---
    if (url.pathname === "/api/v2/meta/views/v1/filters" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "flt1", comparison_op: "eq" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/views/v1/filters" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "flt-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/filters/flt1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "flt1", comparison_op: "eq" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/filters/flt1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "flt1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/filters/flt1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Sorts ---
    if (url.pathname === "/api/v2/meta/views/v1/sorts" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "srt1", direction: "asc" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/views/v1/sorts" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "srt-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/sorts/srt1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "srt1", direction: "asc" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/sorts/srt1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "srt1", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/sorts/srt1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    // --- Me (auth check) ---
    if (url.pathname === "/api/v2/auth/user/me" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "usr1", email: "test@example.com", display_name: "Test User", roles: "owner" }));
      return;
    }

    // --- Filter Children ---
    if (url.pathname === "/api/v2/meta/filters/flt1/children" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "flt_child1", fk_column_id: "c1", comparison_op: "eq", value: "test" }], pageInfo: {} }));
      return;
    }

    // --- Hook Filters ---
    if (url.pathname === "/api/v2/meta/hooks/hk1/filters" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "hf1", fk_column_id: "c1", comparison_op: "eq" }], pageInfo: {} }));
      return;
    }
    if (url.pathname === "/api/v2/meta/hooks/hk1/filters" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "hf-new", ...(body as object) }));
      return;
    }

    // --- Set Primary Column ---
    if (url.pathname === "/api/v2/meta/columns/c1/primary" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }

    // --- Duplicate Operations ---
    if (url.pathname === "/api/v2/meta/duplicate/b1" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "job_dup_base", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/duplicate/b1/src1" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "job_dup_src", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/duplicate/b1/table/t1" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "job_dup_tbl", ...(body as object) }));
      return;
    }

    // --- Visibility Rules ---
    if (url.pathname === "/api/v2/meta/bases/b1/visibility-rules" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ id: "vw1", title: "Grid", disabled: { viewer: true } }]));
      return;
    }
    if (url.pathname === "/api/v2/meta/bases/b1/visibility-rules" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }

    // --- App Info ---
    if (url.pathname === "/api/v2/meta/nocodb/info" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ version: "0.250.0", authType: "jwt", isDocker: true }));
      return;
    }

    // --- Cloud Workspaces ---
    if (url.pathname === "/api/v2/meta/workspaces" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "ws1", title: "MyWorkspace" }], pageInfo: { totalRows: 1 } }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "ws-new", ...(body as object) }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ workspace: { id: "ws1", title: "MyWorkspace" }, workspaceUserCount: 3 }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/users" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ email: "alice@test.com", roles: "owner", fk_user_id: "u1" }], pageInfo: { totalRows: 1 } }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/users/u1" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ email: "alice@test.com", roles: "owner", fk_user_id: "u1" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/invitations" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/users/u1" && req.method === "PATCH") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/users/u1" && req.method === "DELETE") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ msg: "success" }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/bases" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list: [{ id: "b1", title: "Base1" }], pageInfo: { totalRows: 1 } }));
      return;
    }
    if (url.pathname === "/api/v2/meta/workspaces/ws1/bases" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "b-new", ...(body as object) }));
      return;
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

function captureLogs(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (msg?: unknown) => { logs.push(String(msg ?? "")); };
  return { logs, restore: () => { console.log = originalLog; } };
}

describe("meta-crud e2e: bases", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("bases list returns bases", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "list", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/bases")).toBe(true);
      expect(logs.join("\n")).toContain("Base1");
    } finally { restore(); server.close(); }
  });

  it("bases get fetches a single base", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "get", "b1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/bases/b1")).toBe(true);
      expect(logs.join("\n")).toContain("Base1");
    } finally { restore(); server.close(); }
  });

  it("bases info fetches base info", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-info-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "info", "b1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/bases/b1/info")).toBe(true);
      expect(logs.join("\n")).toContain("true");
    } finally { restore(); server.close(); }
  });

  it("bases create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "create", "--data", '{"title":"NewBase"}', "--pretty"], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/bases");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewBase" });
      expect(logs.join("\n")).toContain("b-new");
    } finally { restore(); server.close(); }
  });

  it("bases update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["bases", "update", "b1", "--data", '{"title":"Renamed"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/bases/b1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ title: "Renamed" });
    } finally { server.close(); }
  });

  it("bases delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-bases-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["bases", "delete", "b1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/bases/b1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("meta-crud e2e: tables", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("tables list returns tables", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-tables-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["tables", "list", "b1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/bases/b1/tables")).toBe(true);
      expect(logs.join("\n")).toContain("Table1");
    } finally { restore(); server.close(); }
  });

  it("tables get fetches a single table", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-tables-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["tables", "get", "t1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/tables/t1")).toBe(true);
      expect(logs.join("\n")).toContain("Table1");
    } finally { restore(); server.close(); }
  });

  it("tables create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-tables-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["tables", "create", "b1", "--data", '{"title":"NewTable"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/bases/b1/tables");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewTable" });
    } finally { server.close(); }
  });

  it("tables update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-tables-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["tables", "update", "t1", "--data", '{"title":"Renamed"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/tables/t1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ title: "Renamed" });
    } finally { server.close(); }
  });

  it("tables delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-tables-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["tables", "delete", "t1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/tables/t1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("meta-crud e2e: views", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("views list returns views", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["views", "list", "t1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/tables/t1/views")).toBe(true);
      expect(logs.join("\n")).toContain("View1");
    } finally { restore(); server.close(); }
  });

  it("views get fetches a single view by listing and filtering", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["views", "get", "t1", "v1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/tables/t1/views")).toBe(true);
      expect(logs.join("\n")).toContain("View1");
    } finally { restore(); server.close(); }
  });

  it("views create posts body to grid endpoint by default", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["views", "create", "t1", "--data", '{"title":"NewView"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/tables/t1/grids");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewView" });
    } finally { server.close(); }
  });

  it("views create with --type form posts to form endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-create-form-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["views", "create", "t1", "--type", "form", "--data", '{"title":"MyForm"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/tables/t1/forms");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "MyForm" });
    } finally { server.close(); }
  });

  it("views update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["views", "update", "v1", "--data", '{"title":"Renamed"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/views/v1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ title: "Renamed" });
    } finally { server.close(); }
  });

  it("views delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-views-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["views", "delete", "v1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/views/v1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("meta-crud e2e: columns", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("columns list returns columns", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cols-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["columns", "list", "t1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/tables/t1/columns")).toBe(true);
      expect(logs.join("\n")).toContain("Col1");
    } finally { restore(); server.close(); }
  });

  it("columns get fetches a single column", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cols-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["columns", "get", "c1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/columns/c1")).toBe(true);
      expect(logs.join("\n")).toContain("Col1");
    } finally { restore(); server.close(); }
  });

  it("columns create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cols-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["columns", "create", "t1", "--data", '{"title":"NewCol","uidt":"SingleLineText"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/tables/t1/columns");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewCol", uidt: "SingleLineText" });
    } finally { server.close(); }
  });

  it("columns update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cols-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["columns", "update", "c1", "--data", '{"title":"Renamed"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/columns/c1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ title: "Renamed" });
    } finally { server.close(); }
  });

  it("columns delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-cols-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["columns", "delete", "c1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/columns/c1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("meta-crud e2e: filters", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("filters list returns filters", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-filters-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["filters", "list", "v1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/views/v1/filters")).toBe(true);
      expect(logs.join("\n")).toContain("flt1");
    } finally { restore(); server.close(); }
  });

  it("filters get fetches a single filter", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-filters-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["filters", "get", "flt1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/filters/flt1")).toBe(true);
      expect(logs.join("\n")).toContain("eq");
    } finally { restore(); server.close(); }
  });

  it("filters create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-filters-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["filters", "create", "v1", "--data", '{"comparison_op":"gt","value":"5"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/views/v1/filters");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ comparison_op: "gt", value: "5" });
    } finally { server.close(); }
  });

  it("filters update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-filters-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["filters", "update", "flt1", "--data", '{"value":"10"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/filters/flt1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ value: "10" });
    } finally { server.close(); }
  });

  it("filters delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-filters-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["filters", "delete", "flt1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/filters/flt1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("meta-crud e2e: sorts", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("sorts list returns sorts", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-sorts-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["sorts", "list", "v1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/views/v1/sorts")).toBe(true);
      expect(logs.join("\n")).toContain("srt1");
    } finally { restore(); server.close(); }
  });

  it("sorts get fetches a single sort", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-sorts-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["sorts", "get", "srt1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/sorts/srt1")).toBe(true);
      expect(logs.join("\n")).toContain("asc");
    } finally { restore(); server.close(); }
  });

  it("sorts create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-sorts-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["sorts", "create", "v1", "--data", '{"direction":"desc"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/views/v1/sorts");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ direction: "desc" });
    } finally { server.close(); }
  });

  it("sorts update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-sorts-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["sorts", "update", "srt1", "--data", '{"direction":"desc"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/sorts/srt1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ direction: "desc" });
    } finally { server.close(); }
  });

  it("sorts delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-sorts-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["sorts", "delete", "srt1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/sorts/srt1")).toBe(true);
    } finally { server.close(); }
  });
});

describe("me e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("me returns user profile", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-me-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["me", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/auth/user/me")).toBe(true);
      const output = logs.join("\n");
      expect(output).toContain("test@example.com");
      expect(output).toContain("Test User");
    } finally { restore(); server.close(); }
  });

  it("me with --select filters fields", async () => {
    const { server, baseUrl } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-me-select-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["me", "--select", "email,display_name"], configDir);

      const output = logs.join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ email: "test@example.com", display_name: "Test User" });
      expect(parsed).not.toHaveProperty("id");
      expect(parsed).not.toHaveProperty("roles");
    } finally { restore(); server.close(); }
  });
});

describe("filter children e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("filters children lists child filters", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-flt-children-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["filters", "children", "flt1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/filters/flt1/children")).toBe(true);
      expect(logs.join("\n")).toContain("flt_child1");
    } finally { restore(); server.close(); }
  });
});

describe("hook filters e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("hooks filters list returns hook filters", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-hook-flt-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["hooks", "filters", "list", "hk1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/hooks/hk1/filters")).toBe(true);
      expect(logs.join("\n")).toContain("hf1");
    } finally { restore(); server.close(); }
  });

  it("hooks filters create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-hook-flt-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["hooks", "filters", "create", "hk1", "--data", '{"fk_column_id":"c1","comparison_op":"eq","value":"active"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/hooks/hk1/filters");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ fk_column_id: "c1", comparison_op: "eq", value: "active" });
    } finally { server.close(); }
  });
});

describe("set primary column e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("columns set-primary posts to correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-set-primary-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["columns", "set-primary", "c1"], configDir);

      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v2/meta/columns/c1/primary")).toBe(true);
      expect(logs.join("\n")).toContain("success");
    } finally { restore(); server.close(); }
  });
});

describe("duplicate e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("duplicate base posts to correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-dup-base-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["duplicate", "base", "b1"], configDir);

      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v2/meta/duplicate/b1")).toBe(true);
      expect(logs.join("\n")).toContain("job_dup_base");
    } finally { restore(); server.close(); }
  });

  it("duplicate base with --exclude-data sends options", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-dup-base-opts-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["duplicate", "base", "b1", "--exclude-data"], configDir);

      const dupCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/duplicate/b1");
      expect(dupCall).toBeDefined();
      expect(dupCall?.body).toEqual({ options: { excludeData: true } });
    } finally { server.close(); }
  });

  it("duplicate table posts to correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-dup-tbl-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["duplicate", "table", "t1", "--base-id", "b1"], configDir);

      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v2/meta/duplicate/b1/table/t1")).toBe(true);
      expect(logs.join("\n")).toContain("job_dup_tbl");
    } finally { restore(); server.close(); }
  });

  it("duplicate source posts to correct endpoint", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-dup-src-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["duplicate", "source", "src1", "--base-id", "b1"], configDir);

      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v2/meta/duplicate/b1/src1")).toBe(true);
      expect(logs.join("\n")).toContain("job_dup_src");
    } finally { restore(); server.close(); }
  });
});

describe("visibility rules e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("visibility-rules get returns rules", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-vis-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["visibility-rules", "get", "b1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/bases/b1/visibility-rules")).toBe(true);
      expect(logs.join("\n")).toContain("Grid");
    } finally { restore(); server.close(); }
  });

  it("visibility-rules set posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-vis-set-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["visibility-rules", "set", "b1", "--data", '[{"id":"vw1","disabled":{"viewer":true}}]'], configDir);

      const setCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/bases/b1/visibility-rules");
      expect(setCall).toBeDefined();
      expect(setCall?.body).toEqual([{ id: "vw1", disabled: { viewer: true } }]);
    } finally { server.close(); }
  });
});

describe("app info e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("info returns server info", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-info-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["info", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/nocodb/info")).toBe(true);
      const output = logs.join("\n");
      expect(output).toContain("0.250.0");
      expect(output).toContain("jwt");
    } finally { restore(); server.close(); }
  });
});

describe("--select flag e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("bases list --select filters list items", async () => {
    const { server, baseUrl } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-select-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "list", "--select", "id"], configDir);

      const output = logs.join("\n");
      const parsed = JSON.parse(output);
      expect(parsed.list).toEqual([{ id: "b1" }]);
      expect(parsed.list[0]).not.toHaveProperty("title");
    } finally { restore(); server.close(); }
  });

  it("bases get --select filters single object", async () => {
    const { server, baseUrl } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-select-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "get", "b1", "--select", "title"], configDir);

      const output = logs.join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ title: "Base1" });
      expect(parsed).not.toHaveProperty("id");
    } finally { restore(); server.close(); }
  });

  it("--select works with --format csv", async () => {
    const { server, baseUrl } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-select-csv-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["bases", "list", "--select", "title", "--format", "csv"], configDir);

      const output = logs.join("\n");
      expect(output).toContain("title");
      expect(output).toContain("Base1");
      expect(output).not.toContain("id");
    } finally { restore(); server.close(); }
  });
});

describe("cloud workspace e2e", () => {
  afterEach(() => {
    delete process.env.NOCO_CONFIG_DIR;
    delete process.env.NOCO_QUIET;
    vi.restoreAllMocks();
  });

  it("workspace cloud list returns workspaces", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-list-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["workspace", "cloud", "list", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/workspaces")).toBe(true);
      expect(logs.join("\n")).toContain("MyWorkspace");
    } finally { restore(); server.close(); }
  });

  it("workspace cloud get returns workspace with user count", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["workspace", "cloud", "get", "ws1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/workspaces/ws1")).toBe(true);
      const output = logs.join("\n");
      expect(output).toContain("MyWorkspace");
      expect(output).toContain("workspaceUserCount");
    } finally { restore(); server.close(); }
  });

  it("workspace cloud create posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-create-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "create", "--data", '{"title":"NewWS"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/workspaces");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewWS" });
    } finally { server.close(); }
  });

  it("workspace cloud update patches body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-update-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "update", "ws1", "--data", '{"title":"Renamed"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/workspaces/ws1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ title: "Renamed" });
    } finally { server.close(); }
  });

  it("workspace cloud delete sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-delete-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "delete", "ws1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/workspaces/ws1")).toBe(true);
    } finally { server.close(); }
  });

  it("workspace cloud users lists workspace users", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-users-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["workspace", "cloud", "users", "ws1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/workspaces/ws1/users")).toBe(true);
      expect(logs.join("\n")).toContain("alice@test.com");
    } finally { restore(); server.close(); }
  });

  it("workspace cloud user-get returns user", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-user-get-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["workspace", "cloud", "user-get", "ws1", "u1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/workspaces/ws1/users/u1")).toBe(true);
      expect(logs.join("\n")).toContain("alice@test.com");
    } finally { restore(); server.close(); }
  });

  it("workspace cloud invite posts invitation", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-invite-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "invite", "ws1", "--data", '{"email":"bob@test.com","roles":"viewer"}'], configDir);

      const inviteCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/workspaces/ws1/invitations");
      expect(inviteCall).toBeDefined();
      expect(inviteCall?.body).toEqual({ email: "bob@test.com", roles: "viewer" });
    } finally { server.close(); }
  });

  it("workspace cloud user-update patches user role", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-user-upd-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "user-update", "ws1", "u1", "--data", '{"roles":"editor"}'], configDir);

      const updateCall = calls.find((c) => c.method === "PATCH" && c.path === "/api/v2/meta/workspaces/ws1/users/u1");
      expect(updateCall).toBeDefined();
      expect(updateCall?.body).toEqual({ roles: "editor" });
    } finally { server.close(); }
  });

  it("workspace cloud user-remove sends DELETE", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-user-rm-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "user-remove", "ws1", "u1"], configDir);

      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v2/meta/workspaces/ws1/users/u1")).toBe(true);
    } finally { server.close(); }
  });

  it("workspace cloud bases lists workspace bases", async () => {
    const { server, baseUrl, calls } = await startServer();
    const { logs, restore } = captureLogs();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-bases-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);
      process.env.NOCO_QUIET = "0";

      await runCli(["workspace", "cloud", "bases", "ws1", "--pretty"], configDir);

      expect(calls.some((c) => c.method === "GET" && c.path === "/api/v2/meta/workspaces/ws1/bases")).toBe(true);
      expect(logs.join("\n")).toContain("Base1");
    } finally { restore(); server.close(); }
  });

  it("workspace cloud create-base posts body", async () => {
    const { server, baseUrl, calls } = await startServer();
    try {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-ws-cloud-create-base-"));
      process.env.NOCO_QUIET = "1";
      await runCli(["config", "set", "baseUrl", baseUrl], configDir);

      await runCli(["workspace", "cloud", "create-base", "ws1", "--data", '{"title":"NewBase"}'], configDir);

      const createCall = calls.find((c) => c.method === "POST" && c.path === "/api/v2/meta/workspaces/ws1/bases");
      expect(createCall).toBeDefined();
      expect(createCall?.body).toEqual({ title: "NewBase" });
    } finally { server.close(); }
  });
});
