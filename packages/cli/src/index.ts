#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MetaApi, NocoClient, parseHeader, DataApi } from "@nocodb/sdk";
import {
  applyPathParams,
  extractOperations,
  findOperation,
  formatCsv,
  formatTable,
  getBaseIdFromArgv as parseBaseIdArgv,
  getPathParamNames,
  isHttpMethod,
  isSwaggerDoc,
  listEndpoints,
  parseKeyValue,
  slugify,
  validateRequestBody,
  type Operation,
  type SwaggerDoc,
  type SwaggerOperation,
  type SwaggerParameter,
  type SwaggerRequestBody,
} from "./lib.js";
import { createConfig, deleteHeader, getHeaders, setHeader } from "./config.js";

const config = createConfig();

function getBaseUrl(): string {
  const baseUrl = config.get("baseUrl");
  if (!baseUrl) {
    throw new Error("Base URL is not set. Run: nocodb config set baseUrl <url>");
  }
  return baseUrl;
}

function getBaseId(fallback?: string): string {
  const baseId = fallback ?? config.get("baseId");
  if (!baseId) {
    throw new Error("Base id is not set. Use --base <id> or: nocodb config set baseId <id>");
  }
  return baseId;
}

function getHeadersConfig(): Record<string, string> {
  return getHeaders(config);
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await fs.promises.readFile(path, "utf8");
  return JSON.parse(raw);
}

function getCacheDir(): string {
  const configPath = config.path;
  const dir = path.dirname(configPath);
  return path.join(dir, "cache");
}

async function writeJsonFile(filePath: string, data: unknown, pretty?: boolean): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const raw = JSON.stringify(data, null, pretty ? 2 : 0);
  await fs.promises.writeFile(filePath, raw, "utf8");
}

async function readJsonInput(data?: string, dataFile?: string): Promise<unknown> {
  if (dataFile) {
    return readJsonFile(dataFile);
  }
  if (data) {
    return JSON.parse(data);
  }
  throw new Error("Provide --data or --data-file");
}

function printResult(result: unknown, options?: { pretty?: boolean; format?: string } | boolean): void {
  if (process.env.NOCO_QUIET === "1") {
    return;
  }
  if (typeof result === "string") {
    console.log(result);
    return;
  }
  const pretty = typeof options === "boolean" ? options : options?.pretty;
  const format = typeof options === "boolean" ? "json" : (options?.format ?? "json");
  if (format === "csv") {
    console.log(formatCsv(result));
    return;
  }
  if (format === "table") {
    console.log(formatTable(result));
    return;
  }
  console.log(JSON.stringify(result, null, pretty ? 2 : 0));
}

function createMeta(): MetaApi {
  const baseUrl = getBaseUrl();
  const headers = getHeadersConfig();
  const client = new NocoClient({ baseUrl, headers });
  return new MetaApi(client);
}

function createData(): DataApi {
  const baseUrl = getBaseUrl();
  const headers = getHeadersConfig();
  const client = new NocoClient({ baseUrl, headers });
  return new DataApi(client);
}

const program = new Command();
program
  .name("nocodb")
  .description("NocoDB CLI (v2)")
  .version("0.1.0")
  .option("--base <baseId>", "Default base id for dynamic API calls");

const configCmd = program.command("config").description("Manage CLI configuration");

configCmd
  .command("set")
  .argument("key", "Configuration key")
  .argument("value", "Configuration value")
  .action((key: string, value: string) => {
    if (key === "baseUrl") {
      config.set("baseUrl", value);
      if (process.env.NOCO_QUIET !== "1") {
        console.log("baseUrl set");
      }
      return;
    }
    if (key === "baseId") {
      config.set("baseId", value);
      if (process.env.NOCO_QUIET !== "1") {
        console.log("baseId set");
      }
      return;
    }
    console.error("Unsupported key. Supported keys: baseUrl, baseId");
    process.exitCode = 1;
  });

configCmd
  .command("get")
  .argument("key", "Configuration key")
  .action((key: string) => {
    if (key === "baseUrl") {
      const baseUrl = config.get("baseUrl");
      if (!baseUrl) {
        console.error("baseUrl is not set");
        process.exitCode = 1;
        return;
      }
      if (process.env.NOCO_QUIET !== "1") {
        console.log(baseUrl);
      }
      return;
    }
    if (key === "baseId") {
      const baseId = config.get("baseId");
      if (!baseId) {
        console.error("baseId is not set");
        process.exitCode = 1;
        return;
      }
      if (process.env.NOCO_QUIET !== "1") {
        console.log(baseId);
      }
      return;
    }
    console.error("Unsupported key. Supported keys: baseUrl, baseId");
    process.exitCode = 1;
  });

configCmd
  .command("show")
  .description("Show current configuration")
  .action(() => {
    const baseUrl = config.get("baseUrl") ?? null;
    const baseId = config.get("baseId") ?? null;
    const headers = config.get("headers") ?? {};
    if (process.env.NOCO_QUIET !== "1") {
      console.log(JSON.stringify({ baseUrl, baseId, headers }, null, 2));
    }
  });

const headerCmd = program.command("header").description("Manage default headers");

headerCmd
  .command("set")
  .argument("name", "Header name")
  .argument("value", "Header value")
  .action((name: string, value: string) => {
    setHeader(config, name, value);
    if (process.env.NOCO_QUIET !== "1") {
      console.log(`header '${name}' set`);
    }
  });

headerCmd
  .command("delete")
  .argument("name", "Header name")
  .action((name: string) => {
    deleteHeader(config, name);
    if (process.env.NOCO_QUIET !== "1") {
      console.log(`header '${name}' deleted`);
    }
  });

headerCmd
  .command("list")
  .action(() => {
    if (process.env.NOCO_QUIET !== "1") {
      console.log(JSON.stringify(getHeadersConfig(), null, 2));
    }
  });

program
  .command("request")
  .description("Make a raw API request")
  .argument("method", "HTTP method")
  .argument("path", "API path, e.g. /api/v2/meta/projects")
  .option("-q, --query <key=value>", "Query string parameter", collect, [])
  .option("-H, --header <name: value>", "Request header", collect, [])
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (method: string, path: string, options: {
    query: string[];
    header: string[];
    data?: string;
    dataFile?: string;
    pretty?: boolean;
    format?: string;
  }) => {
    try {
      const baseUrl = getBaseUrl();
      const headers = getHeadersConfig();
      const client = new NocoClient({ baseUrl, headers });

      const query: Record<string, string> = {};
      for (const item of options.query ?? []) {
        const [key, value] = parseKeyValue(item);
        query[key] = value;
      }

      const requestHeaders: Record<string, string> = {};
      for (const item of options.header ?? []) {
        const [name, value] = parseHeader(item);
        requestHeaders[name] = value;
      }

      let body: unknown;
      if (options.dataFile) {
        body = await readJsonFile(options.dataFile);
      } else if (options.data) {
        body = JSON.parse(options.data);
      }

      const result = await client.request<unknown>(method, path, {
        query: Object.keys(query).length ? query : undefined,
        headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
        body,
      });

      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const basesCmd = program.command("bases").description("Manage bases");

basesCmd
  .command("list")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listBases();
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

basesCmd
  .command("get")
  .argument("baseId", "Base id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getBase(baseId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

basesCmd
  .command("info")
  .argument("baseId", "Base id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getBaseInfo(baseId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

basesCmd
  .command("create")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createBase(body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

basesCmd
  .command("update")
  .argument("baseId", "Base id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateBase(baseId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

basesCmd
  .command("delete")
  .argument("baseId", "Base id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteBase(baseId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const tablesCmd = program.command("tables").description("Manage tables");

tablesCmd
  .command("list")
  .argument("baseId", "Base id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listTables(baseId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

tablesCmd
  .command("get")
  .argument("tableId", "Table id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getTable(tableId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

tablesCmd
  .command("create")
  .argument("baseId", "Base id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (baseId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createTable(baseId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

tablesCmd
  .command("update")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateTable(tableId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

tablesCmd
  .command("delete")
  .argument("tableId", "Table id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteTable(tableId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const viewsCmd = program.command("views").description("Manage views");

viewsCmd
  .command("list")
  .argument("tableId", "Table id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listViews(tableId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

viewsCmd
  .command("get")
  .argument("viewId", "View id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getView(viewId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

viewsCmd
  .command("create")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createView(tableId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

viewsCmd
  .command("update")
  .argument("viewId", "View id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateView(viewId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

viewsCmd
  .command("delete")
  .argument("viewId", "View id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteView(viewId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const filtersCmd = program.command("filters").description("Manage view filters");

filtersCmd
  .command("list")
  .argument("viewId", "View id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listViewFilters(viewId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

filtersCmd
  .command("get")
  .argument("filterId", "Filter id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (filterId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getFilter(filterId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

filtersCmd
  .command("create")
  .argument("viewId", "View id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createViewFilter(viewId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

filtersCmd
  .command("update")
  .argument("filterId", "Filter id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (filterId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateFilter(filterId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

filtersCmd
  .command("delete")
  .argument("filterId", "Filter id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (filterId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteFilter(filterId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const sortsCmd = program.command("sorts").description("Manage view sorts");

sortsCmd
  .command("list")
  .argument("viewId", "View id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listViewSorts(viewId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

sortsCmd
  .command("get")
  .argument("sortId", "Sort id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (sortId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getSort(sortId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

sortsCmd
  .command("create")
  .argument("viewId", "View id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (viewId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createViewSort(viewId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

sortsCmd
  .command("update")
  .argument("sortId", "Sort id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (sortId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateSort(sortId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

sortsCmd
  .command("delete")
  .argument("sortId", "Sort id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (sortId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteSort(sortId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const columnsCmd = program.command("columns").description("Manage table columns");

columnsCmd
  .command("list")
  .argument("tableId", "Table id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.listColumns(tableId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

columnsCmd
  .command("get")
  .argument("columnId", "Column id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (columnId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.getColumn(columnId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

columnsCmd
  .command("create")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.createColumn(tableId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

columnsCmd
  .command("update")
  .argument("columnId", "Column id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (columnId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await meta.updateColumn(columnId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

columnsCmd
  .command("delete")
  .argument("columnId", "Column id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (columnId: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.deleteColumn(columnId);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const metaCmd = program.command("meta").description("Meta utilities");

metaCmd
  .command("swagger")
  .argument("baseId", "Base id")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .option("--out <path>", "Write swagger JSON to a file")
  .option("--no-cache", "Do not use cached swagger")
  .action(async (baseId: string, options: { pretty?: boolean; format?: string; out?: string; cache?: boolean }) => {
    try {
      const doc = await loadSwagger(baseId, options.cache !== false);

      if (options.out) {
        await writeJsonFile(options.out, doc, options.pretty);
        console.log(options.out);
        return;
      }

      printResult(doc, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

metaCmd
  .command("endpoints")
  .argument("baseId", "Base id")
  .option("--tag <name>", "Filter by tag")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .option("--no-cache", "Do not use cached swagger")
  .action(async (baseId: string, options: { tag?: string; pretty?: boolean; format?: string; cache?: boolean }) => {
    try {
      const doc = await loadSwagger(baseId, options.cache !== false);
      const endpoints = listEndpoints(doc, options.tag);
      if (options.format === "csv" || options.format === "table") {
        printResult(endpoints.map((e) => ({ endpoint: e })), options);
      } else if (options.pretty) {
        console.log(JSON.stringify(endpoints, null, 2));
      } else {
        for (const line of endpoints) {
          console.log(line);
        }
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

metaCmd
  .command("cache")
  .description("Manage cached swagger docs")
  .command("clear")
  .argument("[baseId]", "Base id (omit to clear all)")
  .option("--all", "Clear all cached swagger docs")
  .action(async (baseId: string | undefined, options: { all?: boolean }) => {
    try {
      const cacheDir = getCacheDir();
      if (options.all || !baseId) {
        if (fs.existsSync(cacheDir)) {
          const entries = await fs.promises.readdir(cacheDir);
          for (const entry of entries) {
            if (entry.startsWith("swagger-") && entry.endsWith(".json")) {
              await fs.promises.unlink(path.join(cacheDir, entry));
            }
          }
        }
        if (process.env.NOCO_QUIET !== "1") {
          console.log("swagger cache cleared");
        }
        return;
      }
      const cacheFile = path.join(cacheDir, `swagger-${baseId}.json`);
      if (fs.existsSync(cacheFile)) {
        await fs.promises.unlink(cacheFile);
      }
      if (process.env.NOCO_QUIET !== "1") {
        console.log(`swagger cache cleared for ${baseId}`);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const rowsCmd = program.command("rows").description("Table row CRUD (base-scoped)");

rowsCmd
  .command("list")
  .argument("tableId", "Table id")
  .option("-q, --query <key=value>", "Query string parameter", collect, [])
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { query: string[]; pretty?: boolean; format?: string }) => {
    try {
      const baseId = getBaseId(getBaseIdFromArgv());
      const query = parseQuery(options.query ?? []);
      const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
      const result = await client.request("GET", `/api/v2/tables/${tableId}/records`, {
        query: Object.keys(query).length ? query : undefined,
      });
      printResult(result, options);
      await ensureSwaggerCache(baseId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

rowsCmd
  .command("read")
  .argument("tableId", "Table id")
  .argument("recordId", "Record id")
  .option("-q, --query <key=value>", "Query string parameter", collect, [])
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, recordId: string, options: { query: string[]; pretty?: boolean; format?: string }) => {
    try {
      const baseId = getBaseId(getBaseIdFromArgv());
      const query = parseQuery(options.query ?? []);
      const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
      const result = await client.request("GET", `/api/v2/tables/${tableId}/records/${recordId}`, {
        query: Object.keys(query).length ? query : undefined,
      });
      printResult(result, options);
      await ensureSwaggerCache(baseId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

rowsCmd
  .command("create")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "post", `/api/v2/tables/${tableId}/records`);
      if (op) {
        validateRequestBody(op, swagger, body);
      }
      const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
      const result = await client.request("POST", `/api/v2/tables/${tableId}/records`, { body });
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

rowsCmd
  .command("update")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "patch", `/api/v2/tables/${tableId}/records`);
      if (op) {
        validateRequestBody(op, swagger, body);
      }
      const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
      const result = await client.request("PATCH", `/api/v2/tables/${tableId}/records`, { body });
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

rowsCmd
  .command("delete")
  .argument("tableId", "Table id")
  .option("-d, --data <json>", "Request JSON body")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "delete", `/api/v2/tables/${tableId}/records`);
      if (op) {
        validateRequestBody(op, swagger, body);
      }
      const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
      const result = await client.request("DELETE", `/api/v2/tables/${tableId}/records`, { body });
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const linksCmd = program.command("links").description("Manage linked records");

linksCmd
  .command("list")
  .argument("tableId", "Table id")
  .argument("linkFieldId", "Link field id")
  .argument("recordId", "Record id")
  .option("-q, --query <key=value>", "Query string parameter", collect, [])
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, linkFieldId: string, recordId: string, options: { query: string[]; pretty?: boolean; format?: string }) => {
    try {
      const data = createData();
      const query = parseQuery(options.query ?? []);
      const result = await data.listLinks(tableId, linkFieldId, recordId, query);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

linksCmd
  .command("create")
  .argument("tableId", "Table id")
  .argument("linkFieldId", "Link field id")
  .argument("recordId", "Record id")
  .option("-d, --data <json>", "Request JSON body (array of {Id: ...})")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, linkFieldId: string, recordId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const data = createData();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await data.linkRecords(tableId, linkFieldId, recordId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

linksCmd
  .command("delete")
  .argument("tableId", "Table id")
  .argument("linkFieldId", "Link field id")
  .argument("recordId", "Record id")
  .option("-d, --data <json>", "Request JSON body (array of {Id: ...})")
  .option("-f, --data-file <path>", "Request JSON body from file")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (tableId: string, linkFieldId: string, recordId: string, options: { data?: string; dataFile?: string; pretty?: boolean; format?: string }) => {
    try {
      const data = createData();
      const body = await readJsonInput(options.data, options.dataFile);
      const result = await data.unlinkRecords(tableId, linkFieldId, recordId, body);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const storageCmd = program.command("storage").description("File storage operations");

storageCmd
  .command("upload")
  .argument("filePath", "Path to the file to upload")
  .option("--pretty", "Pretty print JSON response")
  .option("--format <type>", "Output format (json, csv, table)")
  .action(async (filePath: string, options: { pretty?: boolean; format?: string }) => {
    try {
      const meta = createMeta();
      const result = await meta.uploadAttachment(filePath);
      printResult(result, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

const apiCmd = program.command("api").description("Dynamic API commands from base swagger");

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function parseQuery(items: string[]): Record<string, string> {
  const query: Record<string, string> = {};
  for (const item of items) {
    const [key, value] = parseKeyValue(item);
    query[key] = value;
  }
  return query;
}

async function bootstrap(): Promise<void> {
  try {
    if (process.argv.includes("api")) {
      const baseId = getBaseId(getBaseIdFromArgv());
      await registerApiCommands(apiCmd, baseId);
    }
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

function shouldAutoRun(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const entryPath = path.resolve(process.argv[1]);
    const currentPath = path.resolve(fileURLToPath(import.meta.url));
    return entryPath === currentPath;
  } catch {
    return true;
  }
}

if (shouldAutoRun()) {
  bootstrap();
}

export { bootstrap };

function getBaseIdFromArgv(): string | undefined {
  return parseBaseIdArgv(process.argv);
}

async function registerApiCommands(parent: Command, baseId: string): Promise<void> {
  const swagger = await loadSwagger(baseId, true);
  const operations = extractOperations(swagger);
  const tags = new Map<string, { cmd: Command; names: Set<string> }>();

  let opCounter = 0;
  for (const op of operations) {
    const tag = op.tags?.[0] ?? "default";
    const safeTag = slugify(tag);
    let tagEntry = tags.get(safeTag);
    if (!tagEntry) {
      tagEntry = { cmd: parent.command(safeTag).description(tag), names: new Set() };
      tags.set(safeTag, tagEntry);
    }

    let opName = slugify(op.operationId ?? `${op.method}-${op.path}`);
    if (!opName) {
      opCounter += 1;
      opName = `operation-${opCounter}`;
    }
    if (tagEntry.names.has(opName)) {
      opCounter += 1;
      opName = `${opName}-${opCounter}`;
    }
    tagEntry.names.add(opName);
    const pathParamNames = getPathParamNames(op.path);
    const opCmd = tagEntry.cmd
      .command(opName)
      .description(`${op.method.toUpperCase()} ${op.path}`);

    for (const paramName of pathParamNames) {
      opCmd.argument(paramName, `Path param: ${paramName}`);
    }

    opCmd
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
      .option("-H, --header <name: value>", "Request header", collect, [])
      .option("-d, --data <json>", "Request JSON body")
      .option("-f, --data-file <path>", "Request JSON body from file")
      .option("--pretty", "Pretty print JSON response")
      .option("--format <type>", "Output format (json, csv, table)")
      .action(async (...args: unknown[]) => {
        try {
          const cmd = args[args.length - 1] as Command;
          const options = cmd.opts<{
            query: string[];
            header: string[];
            data?: string;
            dataFile?: string;
            pretty?: boolean;
            format?: string;
          }>();

          const pathArgs = args.slice(0, pathParamNames.length) as string[];
          const finalPath = applyPathParams(op.path, pathParamNames, pathArgs);

          const query: Record<string, string> = {};
          for (const item of options.query ?? []) {
            const [key, value] = parseKeyValue(item);
            query[key] = value;
          }

          const requestHeaders: Record<string, string> = {};
          for (const item of options.header ?? []) {
            const [name, value] = parseHeader(item);
            requestHeaders[name] = value;
          }

          const body = await maybeReadBody(options.data, options.dataFile);
          validateRequestBody(op, swagger, body);

          const client = new NocoClient({ baseUrl: getBaseUrl(), headers: getHeadersConfig() });
          const result = await client.request(op.method.toUpperCase(), finalPath, {
            query: Object.keys(query).length ? query : undefined,
            headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
            body,
          });

          printResult(result, options);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exitCode = 1;
        }
      });
  }
}

async function loadSwagger(baseId: string, useCache: boolean): Promise<SwaggerDoc> {
  const cacheFile = path.join(getCacheDir(), `swagger-${baseId}.json`);
  if (useCache) {
    try {
      const cached = (await readJsonFile(cacheFile)) as SwaggerDoc;
      if (isSwaggerDoc(cached)) {
        return cached;
      }
    } catch {
      // ignore
    }
  }
  const meta = createMeta();
  const doc = (await meta.getBaseSwagger(baseId)) as SwaggerDoc;
  await writeJsonFile(cacheFile, doc, true);
  return doc;
}

async function ensureSwaggerCache(baseId: string): Promise<void> {
  const cacheFile = path.join(getCacheDir(), `swagger-${baseId}.json`);
  if (!fs.existsSync(cacheFile)) {
    await loadSwagger(baseId, true);
  }
}

async function maybeReadBody(data?: string, dataFile?: string): Promise<unknown | undefined> {
  if (dataFile) {
    return readJsonFile(dataFile);
  }
  if (data) {
    return JSON.parse(data);
  }
  return undefined;
}
