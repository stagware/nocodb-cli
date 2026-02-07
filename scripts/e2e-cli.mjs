#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CLI_DIST = path.join(ROOT, "packages", "cli", "dist", "index.js");

const BASE_URL = process.env.NOCO_BASE_URL;
const BASE_ID = process.env.NOCO_BASE_ID;
const TOKEN = process.env.NOCO_TOKEN;
const KEEP = process.env.NOCO_KEEP === "1";

if (!BASE_URL || !BASE_ID || !TOKEN) {
  console.error("Missing env vars. Set NOCO_BASE_URL, NOCO_BASE_ID, NOCO_TOKEN.");
  process.exit(1);
}

if (!fs.existsSync(CLI_DIST)) {
  console.error(`CLI dist not found at ${CLI_DIST}. Build packages/cli first.`);
  process.exit(1);
}

function runCli(args, input) {
  const result = spawnSync(process.execPath, [CLI_DIST, ...args], {
    input,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `CLI exited ${result.status}`);
  }
  return (result.stdout || "").trim();
}

function runCliAllowFail(args, input) {
  const result = spawnSync(process.execPath, [CLI_DIST, ...args], {
    input,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function jsonParseOrThrow(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON output: ${raw}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function tablePayload(name, columns) {
  return {
    table_name: name,
    title: name,
    columns,
  };
}

function column(colName, uidt) {
  return { column_name: colName, title: colName, uidt };
}

function tryCreateTable(baseId, name, columnSets) {
  const errors = [];
  for (const columns of columnSets) {
    const payload = tablePayload(name, columns);
    const tmp = path.join(ROOT, "scripts", `${name}.json`);
    writeJson(tmp, payload);
    try {
      const out = runCli(["tables", "create", baseId, "--data-file", tmp, "--pretty"]);
      return jsonParseOrThrow(out);
    } catch (err) {
      errors.push(err.message || String(err));
      // try next column set
    }
  }
  throw new Error(`Failed to create table ${name} with provided column sets.\nErrors:\n${errors.join("\n")}`);
}

function createRow(tableId, data) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-row.json`);
  writeJson(tmp, data);
  const out = runCli(["rows", "create", tableId, "--data-file", tmp]);
  return jsonParseOrThrow(out);
}

function listRows(tableId, query) {
  const args = ["rows", "list", tableId];
  for (const [key, value] of Object.entries(query || {})) {
    args.push("--query", `${key}=${value}`);
  }
  const out = runCli(args);
  return jsonParseOrThrow(out);
}

function updateRow(tableId, data) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-row-update.json`);
  writeJson(tmp, data);
  const out = runCli(["rows", "update", tableId, "--data-file", tmp]);
  return jsonParseOrThrow(out);
}

function deleteRow(tableId, data) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-row-delete.json`);
  writeJson(tmp, data);
  const out = runCli(["rows", "delete", tableId, "--data-file", tmp]);
  return jsonParseOrThrow(out);
}

function readRow(tableId, recordId) {
  const out = runCli(["rows", "read", tableId, String(recordId), "--pretty"]);
  return jsonParseOrThrow(out);
}

function fetchSwagger(baseId) {
  const outPath = path.join(ROOT, "scripts", `swagger-${baseId}.json`);
  runCli(["meta", "swagger", baseId, "--out", outPath]);
  const raw = fs.readFileSync(outPath, "utf8");
  return JSON.parse(raw);
}

function clearSwaggerCache(baseId) {
  runCli(["meta", "cache", "clear", baseId]);
}

function findLinkEndpoints(swagger) {
  const links = [];
  const paths = swagger.paths || {};
  for (const [urlPath, methods] of Object.entries(paths)) {
    if (!urlPath.includes("/links/")) continue;
    const params = methods.parameters || [];
    const linkParam = params.find((p) => p.name === "linkFieldId");
    if (!linkParam || !linkParam.schema || !Array.isArray(linkParam.schema.enum)) continue;
    const linkFieldId = linkParam.schema.enum[0];
    const desc = linkParam.description || "";
    const match = desc.match(/\*\s+[^-]+-\s+(.+)$/m);
    const targetTableName = match ? match[1].trim() : undefined;
    const methodKeys = Object.keys(methods).filter((m) => ["get", "post", "delete"].includes(m));
    links.push({ urlPath, methods: methodKeys, linkFieldId, targetTableName });
  }
  return links;
}

function findTableTagForName(swagger, name) {
  const paths = swagger.paths || {};
  for (const methods of Object.values(paths)) {
    for (const op of Object.values(methods)) {
      if (op && op.tags && op.tags[0] === name) {
        return op.tags[0];
      }
    }
  }
  return undefined;
}

function findCreateOpForTag(swagger, tag) {
  const paths = swagger.paths || {};
  for (const [urlPath, methods] of Object.entries(paths)) {
    const post = methods.post;
    if (post && post.tags && post.tags[0] === tag) {
      return { urlPath, operationId: post.operationId };
    }
  }
  return undefined;
}

function addColumn(tableId, payload, retries = 2) {
  let lastResult = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const tmp = path.join(ROOT, "scripts", `${tableId}-col-${Date.now()}.json`);
    writeJson(tmp, payload);
    const result = runCliAllowFail(["columns", "create", tableId, "--data-file", tmp]);
    if (result.status === 0) {
      return result;
    }
    lastResult = result;
  }
  return lastResult ?? { status: 1, stdout: "", stderr: "column create failed" };
}

function updateColumn(columnId, payload) {
  if (!columnId) {
    return { status: 1, stdout: "", stderr: "Missing column id" };
  }
  const tmp = path.join(ROOT, "scripts", `${columnId}-col-update.json`);
  writeJson(tmp, payload);
  return runCliAllowFail(["columns", "update", columnId, "--data-file", tmp]);
}

function fetchTableMeta(tableId) {
  const out = runCliAllowFail(["tables", "get", tableId, "--pretty"]);
  if (out.status !== 0) {
    return undefined;
  }
  return jsonParseOrThrow(out.stdout);
}

function fetchColumnMeta(columnId) {
  const out = runCliAllowFail(["columns", "get", columnId, "--pretty"]);
  if (out.status !== 0) {
    return undefined;
  }
  return jsonParseOrThrow(out.stdout);
}

function findColumnByTitle(tableMeta, title) {
  const columns = tableMeta?.columns || [];
  return columns.find((col) => col.title === title);
}

function createRowViaDynamic(baseId, tag, operationId, payload) {
  const tmp = path.join(ROOT, "scripts", `${tag}-row.json`);
  writeJson(tmp, payload);
  const out = runCli(["--base", baseId, "api", slugify(tag), slugify(operationId), "--data-file", tmp]);
  return jsonParseOrThrow(out);
}

// --- Upsert helpers ---
function upsertRow(tableId, matchField, matchValue, data, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-upsert.json`);
  writeJson(tmp, data);
  const out = runCli([
    "--base", BASE_ID,
    "rows", "upsert", tableId,
    "--match", `${matchField}=${matchValue}`,
    "--data-file", tmp,
    ...extraFlags,
  ]);
  return jsonParseOrThrow(out);
}

function upsertRowAllowFail(tableId, matchField, matchValue, data, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-upsert-af.json`);
  writeJson(tmp, data);
  return runCliAllowFail([
    "--base", BASE_ID,
    "rows", "upsert", tableId,
    "--match", `${matchField}=${matchValue}`,
    "--data-file", tmp,
    ...extraFlags,
  ]);
}

// --- Bulk helpers ---
function bulkCreateRows(tableId, rows, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-bulk-create.json`);
  writeJson(tmp, rows);
  const out = runCli(["--base", BASE_ID, "rows", "bulk-create", tableId, "--data-file", tmp, "--fail-fast", ...extraFlags]);
  return jsonParseOrThrow(out);
}

function bulkUpdateRows(tableId, rows, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-bulk-update.json`);
  writeJson(tmp, rows);
  const out = runCli(["--base", BASE_ID, "rows", "bulk-update", tableId, "--data-file", tmp, "--fail-fast", ...extraFlags]);
  return jsonParseOrThrow(out);
}

function bulkDeleteRows(tableId, rows, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-bulk-delete.json`);
  writeJson(tmp, rows);
  const out = runCli(["--base", BASE_ID, "rows", "bulk-delete", tableId, "--data-file", tmp, "--fail-fast", ...extraFlags]);
  return jsonParseOrThrow(out);
}

function bulkUpsertRows(tableId, matchField, rows, extraFlags = []) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-bulk-upsert.json`);
  writeJson(tmp, rows);
  const out = runCli([
    "--base", BASE_ID,
    "rows", "bulk-upsert", tableId,
    "--match", matchField,
    "--data-file", tmp,
    ...extraFlags,
  ]);
  return jsonParseOrThrow(out);
}

// --- Views helpers ---
function listViews(tableId) {
  const out = runCli(["views", "list", tableId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function createView(tableId, data) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-view.json`);
  writeJson(tmp, data);
  const out = runCli(["views", "create", tableId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function getView(viewId) {
  const out = runCli(["views", "get", viewId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function updateView(viewId, data) {
  const tmp = path.join(ROOT, "scripts", `${viewId}-view-update.json`);
  writeJson(tmp, data);
  const out = runCli(["views", "update", viewId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function deleteView(viewId) {
  return runCliAllowFail(["views", "delete", viewId]);
}

// --- Filters helpers ---
function listFilters(viewId) {
  const out = runCli(["filters", "list", viewId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function createFilter(viewId, data) {
  const tmp = path.join(ROOT, "scripts", `${viewId}-filter.json`);
  writeJson(tmp, data);
  const out = runCli(["filters", "create", viewId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function getFilter(filterId) {
  const out = runCli(["filters", "get", filterId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function updateFilter(filterId, data) {
  const tmp = path.join(ROOT, "scripts", `${filterId}-filter-update.json`);
  writeJson(tmp, data);
  const out = runCli(["filters", "update", filterId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function deleteFilter(filterId) {
  return runCliAllowFail(["filters", "delete", filterId]);
}

// --- Sorts helpers ---
function listSorts(viewId) {
  const out = runCli(["sorts", "list", viewId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function createSort(viewId, data) {
  const tmp = path.join(ROOT, "scripts", `${viewId}-sort.json`);
  writeJson(tmp, data);
  const out = runCli(["sorts", "create", viewId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function getSort(sortId) {
  const out = runCli(["sorts", "get", sortId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function updateSort(sortId, data) {
  const tmp = path.join(ROOT, "scripts", `${sortId}-sort-update.json`);
  writeJson(tmp, data);
  const out = runCli(["sorts", "update", sortId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

function deleteSort(sortId) {
  return runCliAllowFail(["sorts", "delete", sortId]);
}

// --- Bases helpers ---
function listBases() {
  const out = runCli(["bases", "list", "--pretty"]);
  return jsonParseOrThrow(out);
}

function getBase(baseId) {
  const out = runCli(["bases", "get", baseId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function getBaseInfo(baseId) {
  const out = runCli(["bases", "info", baseId, "--pretty"]);
  return jsonParseOrThrow(out);
}

// --- Tables list/update helpers ---
function listTables(baseId) {
  const out = runCli(["tables", "list", baseId, "--pretty"]);
  return jsonParseOrThrow(out);
}

function updateTable(tableId, data) {
  const tmp = path.join(ROOT, "scripts", `${tableId}-table-update.json`);
  writeJson(tmp, data);
  const out = runCli(["tables", "update", tableId, "--data-file", tmp, "--pretty"]);
  return jsonParseOrThrow(out);
}

// --- Request helper ---
function rawRequest(method, apiPath, opts = {}) {
  const args = ["request", method, apiPath];
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      args.push("--query", `${k}=${v}`);
    }
  }
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      args.push("--header", `${k}: ${v}`);
    }
  }
  if (opts.data) {
    args.push("--data", JSON.stringify(opts.data));
  }
  args.push("--pretty");
  const out = runCli(args);
  return jsonParseOrThrow(out);
}

// --- Meta endpoints helper ---
function metaEndpoints(baseId) {
  const out = runCli(["meta", "endpoints", baseId, "--pretty"]);
  return jsonParseOrThrow(out);
}

// --- Storage upload helper ---
function storageUpload(filePath) {
  const out = runCli(["storage", "upload", filePath, "--pretty"]);
  return jsonParseOrThrow(out);
}

// --- Workspace/Alias helpers ---
function workspaceAdd(name, url, token, baseId) {
  const args = ["workspace", "add", name, url, token];
  if (baseId) args.push("--base", baseId);
  return runCli(args);
}

function workspaceUse(name) {
  return runCli(["workspace", "use", name]);
}

function workspaceList() {
  return runCli(["workspace", "list"]);
}

function workspaceShow(name) {
  const args = ["workspace", "show"];
  if (name) args.push(name);
  return runCli(args);
}

function workspaceDelete(name) {
  return runCli(["workspace", "delete", name]);
}

function aliasSet(name, id) {
  return runCli(["alias", "set", name, id]);
}

function aliasList() {
  return runCli(["alias", "list"]);
}

function aliasDelete(name) {
  return runCli(["alias", "delete", name]);
}

function aliasClear() {
  return runCli(["alias", "clear"]);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tableIdFromPath(pathValue) {
  const parts = pathValue.split("/");
  const idx = parts.indexOf("tables");
  if (idx >= 0 && parts[idx + 1]) {
    return parts[idx + 1];
  }
  return undefined;
}

function writeReport(report) {
  const outPath = path.join(ROOT, "scripts", "e2e-report.json");
  writeJson(outPath, report);
  console.log(`Report written to ${outPath}`);
}

function writeReportMarkdown(report) {
  const mdPath = path.join(ROOT, "scripts", "e2e-report.md");
  const lines = [];
  lines.push(`# NocoDB CLI E2E Report`);
  lines.push(``);
  lines.push(`Base: ${report.baseUrl} (id: ${report.baseId})`);
  lines.push(`Started: ${report.startedAt}`);
  lines.push(`Finished: ${report.finishedAt || ""}`);
  lines.push(``);
  if (report.summary) {
    lines.push(`## Summary`);
    lines.push(`- Columns: ${report.summary.columns.passed} passed, ${report.summary.columns.failed} failed, ${report.summary.columns.skipped} skipped`);
    lines.push(`- Links: ${report.summary.links.passed} passed, ${report.summary.links.failed} failed`);
    if (report.summary.features) {
      lines.push(`- Features: ${report.summary.features.passed} passed, ${report.summary.features.failed} failed, ${report.summary.features.skipped} skipped`);
    }
    lines.push(``);
  }
  lines.push(`## Tables`);
  for (const table of report.tables || []) {
    lines.push(`- ${table.name} (${table.id})`);
  }
  lines.push(``);
  lines.push(`## Column Tests`);
  for (const col of report.columns || []) {
    const status = col.status.toUpperCase();
    const err = col.error ? ` - ${col.error}` : "";
    lines.push(`- ${status}: ${col.name} [${col.uidt}]${err}`);
  }
  lines.push(``);
  lines.push(`## Link Tests`);
  if (!report.links || report.links.length === 0) {
    lines.push(`- No link tests executed`);
  } else {
    for (const link of report.links) {
      const status = link.status.toUpperCase();
      const err = link.error ? ` - ${link.error}` : "";
      lines.push(`- ${status}: ${link.path} (linkFieldId=${link.linkFieldId})${err}`);
    }
  }
  lines.push(``);
  lines.push(`## Feature Tests`);
  const featureKeys = [
    "workspace", "bases", "tablesExtra", "views", "filters", "sorts",
    "upsert", "bulkOps", "bulkUpsert", "request", "metaEndpoints",
    "dynamicApi", "storageUpload",
  ];
  for (const key of featureKeys) {
    const result = report[key];
    if (!result) {
      lines.push(`- SKIPPED: ${key}`);
    } else {
      const status = result.status.toUpperCase();
      const err = result.error ? ` - ${result.error}` : "";
      lines.push(`- ${status}: ${key}${err}`);
    }
  }
  lines.push(``);
  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  console.log(`Report written to ${mdPath}`);
}

function attemptColumnTest(tableId, rowId, columnDef, sampleValue, report) {

  let createDef = columnDef;
  if ((columnDef.uidt === "SingleSelect" || columnDef.uidt === "MultiSelect") && columnDef.options) {
    const options = columnDef.options.map((opt) => ({ title: opt.title || opt }));
    createDef = { ...columnDef, colOptions: { options } };
    delete createDef.options;
    delete createDef.meta;
  }
  const add = addColumn(tableId, createDef);
  if (add.status !== 0) {
    const error = add.stderr || add.stdout || "column create failed";
    report.columns.push({
      name: createDef.title,
      uidt: createDef.uidt,
      status: "failed",
      error,
    });
    return { ok: false };
  }
  try {
    let valueToWrite = sampleValue;
    let alreadyUpdated = false;
    if (columnDef.uidt === "Attachment") {
      const tmpFile = path.join(ROOT, "scripts", `attachment-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, "nocodb-cli attachment", "utf8");
      const uploads = storageUpload(tmpFile);
      if (!Array.isArray(uploads) || uploads.length === 0) {
        throw new Error("Attachment upload returned no files.");
      }
      updateRow(tableId, { Id: rowId, [columnDef.title]: uploads });
      alreadyUpdated = true;
    }
    if (columnDef.uidt === "SingleSelect" || columnDef.uidt === "MultiSelect") {
      let meta = fetchTableMeta(tableId);
      let colMeta = findColumnByTitle(meta, columnDef.title);
      let options = colMeta?.colOptions?.options || colMeta?.meta?.options || colMeta?.options || [];
      if (!Array.isArray(options) || options.length === 0) {
        const updatePayload = { colOptions: { options: (columnDef.options || []).map((opt) => ({ title: opt.title || opt })) } };
        updateColumn(colMeta?.id, updatePayload);
        meta = fetchTableMeta(tableId);
        colMeta = findColumnByTitle(meta, columnDef.title);
        options = colMeta?.colOptions?.options || colMeta?.meta?.options || colMeta?.options || [];
      }
      if (!Array.isArray(options) || options.length === 0) {
        report.columns.push({
          name: columnDef.title,
          uidt: columnDef.uidt,
          status: "failed",
          error: "No select options found in column meta.",
        });
        return { ok: false };
      }
      const titles = options.map((opt) => opt.title ?? opt).filter(Boolean);
      const ids = options.map((opt) => opt.id ?? opt).filter(Boolean);
      const candidates =
        columnDef.uidt === "SingleSelect"
          ? [
              titles[0],
              { title: titles[0] },
              ids[0],
            ]
          : [
              titles.slice(0, 2),
              titles.slice(0, 2).map((t) => ({ title: t })),
              ids.slice(0, 2),
            ];
      let lastError;
      for (const candidate of candidates) {
        try {
          updateRow(tableId, { Id: rowId, [columnDef.title]: candidate });
          valueToWrite = candidate;
          alreadyUpdated = true;
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (lastError) {
        throw lastError;
      }
    }
    if (!alreadyUpdated) {
      updateRow(tableId, { Id: rowId, [columnDef.title]: valueToWrite });
    }
    const row = readRow(tableId, rowId);
    const value = row[columnDef.title];
    const ok = value !== undefined;
    report.columns.push({
      name: columnDef.title,
      uidt: columnDef.uidt,
      status: ok ? "passed" : "failed",
      error: ok ? undefined : "value not present in read response",
    });
    return { ok };
  } catch (err) {
    report.columns.push({
      name: columnDef.title,
      uidt: columnDef.uidt,
      status: "failed",
      error: err.message || String(err),
    });
    return { ok: false };
  }
}

function tryCreateLinkColumn(primaryId, secondaryId) {
  const payloads = [
    {
      title: "LinkToSecondary",
      column_name: "LinkToSecondary",
      uidt: "Links",
      parentId: primaryId,
      childId: secondaryId,
      type: "hm",
    },
    {
      title: "LinkToSecondary",
      column_name: "LinkToSecondary",
      uidt: "Links",
      parentId: primaryId,
      childId: secondaryId,
      type: "mm",
    },
  ];
  for (const payload of payloads) {
    const result = addColumn(primaryId, payload);
    if (result.status === 0) {
      return { ok: true, payload };
    }
  }
  return { ok: false };
}

async function main() {
  console.log("Configuring CLI...");
  runCli(["config", "set", "baseUrl", BASE_URL]);
  runCli(["config", "set", "baseId", BASE_ID]);
  runCli(["header", "set", "xc-token", TOKEN]);
  // Ensure 'default' workspace is active (config set only activates on first create)
  runCli(["workspace", "use", "default"]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tableA = `CliE2E_Primary_${timestamp}`;
  const tableB = `CliE2E_Secondary_${timestamp}`;

  const basicColumns = [
    column("Title", "SingleLineText"),
    column("Notes", "LongText"),
    column("Score", "Number"),
    column("Done", "Checkbox"),
    column("When", "Date"),
  ];

  const extendedColumns = [
    column("Title", "SingleLineText"),
    column("Notes", "LongText"),
    column("Score", "Number"),
    column("DecimalVal", "Decimal"),
    column("Done", "Checkbox"),
    column("When", "Date"),
    column("WhenTime", "DateTime"),
    column("Email", "Email"),
    column("Url", "URL"),
    column("Phone", "PhoneNumber"),
    column("Percent", "Percent"),
    column("Rating", "Rating"),
    column("JsonData", "JSON"),
    column("Attachment", "Attachment"),
    column("SingleSelect", "SingleSelect"),
    column("MultiSelect", "MultiSelect"),
    column("Currency", "Currency"),
    column("Duration", "Duration"),
    column("GeoData", "GeoData"),
  ];

  const formulaColumns = [
    column("Title", "SingleLineText"),
    column("Score", "Number"),
  ];

  const report = {
    baseId: BASE_ID,
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    tables: [],
    columns: [],
    links: [],
    rows: {},
  };

  console.log("Creating tables...");
  const createdTables = [];
  const primary = tryCreateTable(BASE_ID, tableA, [extendedColumns, basicColumns]);
  createdTables.push(primary.id);
  const secondary = tryCreateTable(BASE_ID, tableB, [basicColumns]);
  createdTables.push(secondary.id);

  const formulaTable = tryCreateTable(BASE_ID, `CliE2E_Formula_${timestamp}`, [formulaColumns, basicColumns]);
  createdTables.push(formulaTable.id);
  report.tables.push(
    { id: primary.id, name: tableA },
    { id: secondary.id, name: tableB },
    { id: formulaTable.id, name: formulaTable.table_name || formulaTable.title || formulaTable.id },
  );

  console.log("Row CRUD on primary...");
  const rowA = createRow(primary.id, { Title: "RowA", Notes: "hello", Score: 5, Done: true });
  report.rows.primaryRowId = rowA.Id;
  updateRow(primary.id, { Id: rowA.Id, Title: "RowA-Updated" });
  readRow(primary.id, rowA.Id);
  listRows(primary.id, { limit: 5 });

  console.log("Row CRUD on secondary...");
  const rowB = createRow(secondary.id, { Title: "RowB" });
  report.rows.secondaryRowId = rowB.Id;
  updateRow(secondary.id, { Id: rowB.Id, Title: "RowB-Updated" });
  readRow(secondary.id, rowB.Id);
  listRows(secondary.id, { limit: 5 });

  console.log("Attempting column feature setup...");
  const tableMeta = fetchTableMeta(primary.id);
  if (!tableMeta) {
    console.log("Could not read table meta; skipping column feature setup.");
  } else {
    const linkResult = tryCreateLinkColumn(primary.id, secondary.id);
    if (linkResult.ok) {
      report.columns.push({ name: "LinkToSecondary", uidt: "LinkToAnotherRecord", status: "passed" });
      const updatedMeta = fetchTableMeta(primary.id);
      const linkCol = findColumnByTitle(updatedMeta, "LinkToSecondary");
      if (linkCol && linkCol.id) {
        const secondaryMeta = fetchTableMeta(secondary.id);
        const secondaryTitle = findColumnByTitle(secondaryMeta, "Title");
        const secondaryTitleId = secondaryTitle?.id;
        const lookupPayload = {
          title: "LookupTitle",
          column_name: "LookupTitle",
          uidt: "Lookup",
          fk_relation_column_id: linkCol.id,
          fk_lookup_column_id: secondaryTitleId,
        };
        if (secondaryTitleId) {
          const lookupResult = addColumn(primary.id, lookupPayload);
          report.columns.push({ name: "LookupTitle", uidt: "Lookup", status: lookupResult.status === 0 ? "passed" : "failed" });
        }

        const rollupPayload = {
          title: "RollupCount",
          column_name: "RollupCount",
          uidt: "Rollup",
          fk_relation_column_id: linkCol.id,
          fk_rollup_column_id: secondaryTitleId,
          rollup_function: "count",
        };
        if (secondaryTitleId) {
          const rollupResult = addColumn(primary.id, rollupPayload);
          report.columns.push({ name: "RollupCount", uidt: "Rollup", status: rollupResult.status === 0 ? "passed" : "failed" });
        }
      }
    } else {
      report.columns.push({ name: "LinkToSecondary", uidt: "LinkToAnotherRecord", status: "failed", error: "link column create failed" });
      console.log("Link column creation failed; skipping lookup/rollup.");
    }

    const formulaPayload = {
      title: "Computed",
      column_name: "Computed",
      uidt: "Formula",
      formula: "{Score}*2",
    };
    const formulaAdd = addColumn(formulaTable.id, formulaPayload);
    report.columns.push({ name: "Computed", uidt: "Formula", status: formulaAdd.status === 0 ? "passed" : "failed" });
  }

  console.log("Refreshing swagger cache...");
  clearSwaggerCache(BASE_ID);
  const swagger = fetchSwagger(BASE_ID);

  console.log("Attempting link tests...");
  const links = findLinkEndpoints(swagger);
  if (links.length === 0) {
    console.log("No link endpoints found in swagger; skipping link tests.");
  } else {
    const link = links[0];
    const tableId = link.urlPath.split("/")[4];
    const columnMeta = fetchColumnMeta(link.linkFieldId);
    const relatedTableId = columnMeta?.colOptions?.fk_related_model_id;
    if (!relatedTableId) {
      console.log("Could not resolve related table for link test; skipping.");
    } else {
      try {
        const relatedRow = createRow(relatedTableId, { Title: "LinkedRow" });
        const linkPayload = [{ Id: relatedRow.Id }];
        const tmp = path.join(ROOT, "scripts", `link-${Date.now()}.json`);
        writeJson(tmp, linkPayload);
        const record = createRow(tableId, { Title: "LinkSource" });
        report.rows.linkSourceId = record.Id;
        console.log(`Testing native links command...`);
        runCli([
          "links",
          "create",
          tableId,
          link.linkFieldId,
          String(record.Id),
          "--data-file",
          tmp,
        ]);
        const listOut = runCli([
          "links",
          "list",
          tableId,
          link.linkFieldId,
          String(record.Id),
          "--pretty",
        ]);
        const list = jsonParseOrThrow(listOut);
        if (!list.list || list.list.length === 0) {
          throw new Error("Linked record not found in list response");
        }
        runCli([
          "links",
          "delete",
          tableId,
          link.linkFieldId,
          String(record.Id),
          "--data-file",
          tmp,
        ]);
        try {
          deleteRow(tableId, { Id: record.Id });
        } catch {
          // ignore
        }
        try {
          deleteRow(relatedTableId, { Id: relatedRow.Id });
        } catch {
          // ignore
        }
        report.links.push({ status: "passed", linkFieldId: link.linkFieldId, path: link.urlPath });
      } catch (err) {
        report.links.push({ status: "failed", linkFieldId: link.linkFieldId, path: link.urlPath, error: err.message || String(err) });
        console.log("Link test failed; continuing.");
      }
    }
  }

  console.log("Testing column types with data...");
  const typeTable = tryCreateTable(BASE_ID, `CliE2E_Types_${timestamp}`, [basicColumns]);
  createdTables.push(typeTable.id);
  report.tables.push({ id: typeTable.id, name: typeTable.table_name || typeTable.title || typeTable.id });
  const typeRow = createRow(typeTable.id, { Title: "TypesRow" });
  report.rows.typeRowId = typeRow.Id;

  const typeMatrix = [
    { def: column("Text", "SingleLineText"), value: "hello" },
    { def: column("LongText", "LongText"), value: "long text" },
    { def: column("NumberCol", "Number"), value: 42 },
    { def: column("DecimalCol", "Decimal"), value: 12.34 },
    { def: column("CheckboxCol", "Checkbox"), value: true },
    { def: column("DateCol", "Date"), value: "2026-02-04" },
    { def: column("DateTimeCol", "DateTime"), value: "2026-02-04 10:00:00" },
    { def: column("EmailCol", "Email"), value: "test@example.com" },
    { def: column("UrlCol", "URL"), value: "https://example.com" },
    { def: column("PhoneCol", "PhoneNumber"), value: "+15555551234" },
    { def: column("PercentCol", "Percent"), value: 75 },
    { def: column("RatingCol", "Rating"), value: 3 },
    { def: column("JsonCol", "JSON"), value: { ok: true } },
    { def: column("CurrencyCol", "Currency"), value: 12.5 },
    { def: column("DurationCol", "Duration"), value: 120 },
    { def: column("GeoCol", "GeoData"), value: { lat: 40.0, lng: -74.0 } },
    { def: column("AttachmentCol", "Attachment"), value: [] },
    { def: { ...column("SingleSelectCol", "SingleSelect"), options: [{ title: "A" }, { title: "B" }] }, value: "A" },
    { def: { ...column("MultiSelectCol", "MultiSelect"), options: [{ title: "A" }, { title: "B" }] }, value: ["A", "B"] },
  ];

  for (const entry of typeMatrix) {
    attemptColumnTest(typeTable.id, typeRow.Id, entry.def, entry.value, report);
  }

  // =========================================================================
  // NEW: Workspace & Alias tests
  // =========================================================================
  console.log("Testing workspace & alias commands...");
  try {
    workspaceAdd("e2e-ws", BASE_URL, TOKEN, BASE_ID);
    workspaceUse("e2e-ws");
    const wsList = workspaceList();
    assert(wsList.includes("e2e-ws"), "workspace list should contain e2e-ws");
    const wsShow = workspaceShow("e2e-ws");
    assert(wsShow.includes(BASE_URL), "workspace show should contain base URL");
    aliasSet("primary", primary.id);
    aliasSet("secondary", secondary.id);
    const aList = aliasList();
    assert(aList.includes("primary"), "alias list should contain primary");
    assert(aList.includes(primary.id), "alias list should contain primary table id");
    // Verify alias resolves: list rows via alias
    const aliasRows = listRows("primary");
    assert(aliasRows.list !== undefined, "alias-resolved rows list should work");
    aliasDelete("secondary");
    const aList2 = aliasList();
    assert(!aList2.includes("secondary"), "alias list should not contain deleted alias");
    aliasClear();
    // Delete the test workspace first so activeWorkspace is cleared
    workspaceDelete("e2e-ws");
    // Restore default config and re-activate it
    runCli(["config", "set", "baseUrl", BASE_URL]);
    runCli(["config", "set", "baseId", BASE_ID]);
    runCli(["header", "set", "xc-token", TOKEN]);
    runCli(["workspace", "use", "default"]);
    report.workspace = { status: "passed" };
  } catch (err) {
    report.workspace = { status: "failed", error: err.message || String(err) };
    // Restore config in case of failure
    try { workspaceDelete("e2e-ws"); } catch { /* ignore */ }
    try {
      runCli(["config", "set", "baseUrl", BASE_URL]);
      runCli(["config", "set", "baseId", BASE_ID]);
      runCli(["header", "set", "xc-token", TOKEN]);
      runCli(["workspace", "use", "default"]);
    } catch { /* ignore */ }
    console.log("Workspace/alias tests failed:", report.workspace.error);
  }

  // =========================================================================
  // NEW: Bases CRUD tests
  // =========================================================================
  console.log("Testing bases list/get/info...");
  try {
    const bases = listBases();
    assert(bases.list && bases.list.length > 0, "bases list should return at least one base");
    const base = getBase(BASE_ID);
    assert(base.id === BASE_ID, "bases get should return the correct base");
    const info = getBaseInfo(BASE_ID);
    assert(info !== undefined, "bases info should return something");
    report.bases = { status: "passed" };
  } catch (err) {
    report.bases = { status: "failed", error: err.message || String(err) };
    console.log("Bases tests failed:", report.bases.error);
  }

  // =========================================================================
  // NEW: Tables list/update tests
  // =========================================================================
  console.log("Testing tables list/update...");
  try {
    const tables = listTables(BASE_ID);
    assert(tables.list && tables.list.length > 0, "tables list should return tables");
    const renamedTitle = `${tableA}_Renamed`;
    const updated = updateTable(primary.id, { title: renamedTitle, table_name: renamedTitle });
    assert(updated !== undefined, "tables update should succeed");
    // Rename back
    updateTable(primary.id, { title: tableA, table_name: tableA });
    report.tablesExtra = { status: "passed" };
  } catch (err) {
    report.tablesExtra = { status: "failed", error: err.message || String(err) };
    console.log("Tables list/update tests failed:", report.tablesExtra.error);
  }

  // =========================================================================
  // NEW: Views CRUD tests
  // =========================================================================
  console.log("Testing views CRUD...");
  let testViewId;
  try {
    const views = listViews(primary.id);
    assert(views.list !== undefined, "views list should return a list");
    assert(views.list.length > 0, "views list should have at least the default view");
    // Create a grid view (views create defaults to grid type)
    const viewTitle = `E2E_GridView_${timestamp}`;
    const newView = createView(primary.id, { title: viewTitle });
    testViewId = newView.id;
    assert(testViewId, "views create should return an id");
    // Verify it appears in the list
    const viewsAfter = listViews(primary.id);
    const found = (viewsAfter.list || []).find((v) => v.id === testViewId);
    assert(found, "created view should appear in views list");
    // Update the view
    const renamedTitle = `${viewTitle}_Renamed`;
    const updatedView = updateView(testViewId, { title: renamedTitle });
    assert(updatedView !== undefined, "views update should succeed");
    report.views = { status: "passed" };
  } catch (err) {
    // Fall back to using the default view for filter/sort tests
    if (!testViewId) {
      try {
        const views = listViews(primary.id);
        testViewId = views.list?.[0]?.id;
      } catch { /* ignore */ }
    }
    report.views = { status: "failed", error: err.message || String(err) };
    console.log("Views tests failed:", report.views.error);
  }

  // =========================================================================
  // NEW: Filters CRUD tests
  // =========================================================================
  console.log("Testing filters CRUD...");
  let testFilterId;
  try {
    if (!testViewId) throw new Error("No view available for filter tests");
    // Get a column id for the filter
    const tMeta = fetchTableMeta(primary.id);
    const titleCol = findColumnByTitle(tMeta, "Title");
    if (!titleCol?.id) throw new Error("No Title column found for filter test");
    const filters = listFilters(testViewId);
    assert(filters.list !== undefined, "filters list should return a list");
    const newFilter = createFilter(testViewId, {
      fk_column_id: titleCol.id,
      comparison_op: "eq",
      value: "test",
    });
    testFilterId = newFilter.id;
    assert(testFilterId, "filters create should return an id");
    const filterDetail = getFilter(testFilterId);
    assert(filterDetail.id === testFilterId, "filters get should return correct filter");
    updateFilter(testFilterId, { value: "updated" });
    deleteFilter(testFilterId);
    testFilterId = undefined;
    report.filters = { status: "passed" };
  } catch (err) {
    report.filters = { status: "failed", error: err.message || String(err) };
    console.log("Filters tests failed:", report.filters.error);
  }

  // =========================================================================
  // NEW: Sorts CRUD tests
  // =========================================================================
  console.log("Testing sorts CRUD...");
  let testSortId;
  try {
    if (!testViewId) throw new Error("No view available for sort tests");
    const tMeta = fetchTableMeta(primary.id);
    const titleCol = findColumnByTitle(tMeta, "Title");
    if (!titleCol?.id) throw new Error("No Title column found for sort test");
    const sorts = listSorts(testViewId);
    assert(sorts.list !== undefined, "sorts list should return a list");
    const newSort = createSort(testViewId, {
      fk_column_id: titleCol.id,
      direction: "asc",
    });
    testSortId = newSort.id;
    assert(testSortId, "sorts create should return an id");
    const sortDetail = getSort(testSortId);
    assert(sortDetail.id === testSortId, "sorts get should return correct sort");
    updateSort(testSortId, { direction: "desc" });
    deleteSort(testSortId);
    testSortId = undefined;
    report.sorts = { status: "passed" };
  } catch (err) {
    report.sorts = { status: "failed", error: err.message || String(err) };
    console.log("Sorts tests failed:", report.sorts.error);
  }

  // Clean up test view
  if (testViewId) {
    try { deleteView(testViewId); } catch { /* ignore */ }
  }

  // =========================================================================
  // NEW: Upsert tests (single row)
  // =========================================================================
  console.log("Testing rows upsert...");
  try {
    // Upsert create: no match -> creates
    const upserted = upsertRow(primary.id, "Title", "UpsertNew", { Title: "UpsertNew", Score: 10 });
    assert(upserted.Id !== undefined, "upsert create should return an Id");
    // Upsert update: match exists -> updates
    const updated = upsertRow(primary.id, "Title", "UpsertNew", { Title: "UpsertNew", Score: 20 });
    assert(updated.Id === upserted.Id, "upsert update should return same Id");
    const readBack = readRow(primary.id, upserted.Id);
    assert(readBack.Score === 20 || String(readBack.Score) === "20", "upsert should have updated Score");
    // --create-only should fail when match exists
    const coFail = upsertRowAllowFail(primary.id, "Title", "UpsertNew", { Title: "UpsertNew", Score: 30 }, ["--create-only"]);
    assert(coFail.status !== 0, "upsert --create-only should fail when match exists");
    // --update-only should fail when no match
    const uoFail = upsertRowAllowFail(primary.id, "Title", "NoSuchRow999", { Title: "NoSuchRow999", Score: 1 }, ["--update-only"]);
    assert(uoFail.status !== 0, "upsert --update-only should fail when no match");
    // Cleanup
    deleteRow(primary.id, { Id: upserted.Id });
    report.upsert = { status: "passed" };
  } catch (err) {
    report.upsert = { status: "failed", error: err.message || String(err) };
    console.log("Upsert tests failed:", report.upsert.error);
  }

  // =========================================================================
  // NEW: Bulk operations tests
  // =========================================================================
  console.log("Testing bulk-create / bulk-update / bulk-delete...");
  try {
    const bulkRows = [
      { Title: "Bulk1", Score: 1 },
      { Title: "Bulk2", Score: 2 },
      { Title: "Bulk3", Score: 3 },
    ];
    const createResult = bulkCreateRows(primary.id, bulkRows);
    assert(createResult !== undefined, "bulk-create should return a result");
    // Read back to get Ids — this is the real verification
    const allRows = listRows(primary.id, { where: "(Title,like,Bulk%)" });
    const bulkIds = (allRows.list || []).filter((r) => r.Title && r.Title.startsWith("Bulk")).map((r) => r.Id);
    assert(bulkIds.length >= 3, "should find at least 3 bulk-created rows");
    // Bulk update
    const updatePayload = bulkIds.map((id) => ({ Id: id, Score: 99 }));
    const updateResult = bulkUpdateRows(primary.id, updatePayload);
    assert(updateResult !== undefined, "bulk-update should return a result");
    // Verify update worked
    const updatedRows = listRows(primary.id, { where: "(Title,like,Bulk%)" });
    const scores = (updatedRows.list || []).filter((r) => r.Title && r.Title.startsWith("Bulk")).map((r) => r.Score);
    assert(scores.every((s) => String(s) === "99"), "bulk-update should have set Score to 99");
    // Bulk delete
    const deletePayload = bulkIds.map((id) => ({ Id: id }));
    const deleteResult = bulkDeleteRows(primary.id, deletePayload);
    assert(deleteResult !== undefined, "bulk-delete should return a result");
    // Verify delete worked
    const afterDelete = listRows(primary.id, { where: "(Title,like,Bulk%)" });
    const remaining = (afterDelete.list || []).filter((r) => r.Title && r.Title.startsWith("Bulk"));
    assert(remaining.length === 0, "bulk-delete should have removed all Bulk rows");
    report.bulkOps = { status: "passed" };
  } catch (err) {
    report.bulkOps = { status: "failed", error: err.message || String(err) };
    console.log("Bulk ops tests failed:", report.bulkOps.error);
  }

  // =========================================================================
  // NEW: Bulk upsert tests
  // =========================================================================
  console.log("Testing bulk-upsert...");
  try {
    // Create some rows first
    createRow(primary.id, { Title: "BulkUpsertExisting", Score: 1 });
    const buResult = bulkUpsertRows(primary.id, "Title", [
      { Title: "BulkUpsertExisting", Score: 50 },  // should update
      { Title: "BulkUpsertNew", Score: 60 },        // should create
    ]);
    assert(buResult !== undefined, "bulk-upsert should return a result");
    // Verify
    const buRows = listRows(primary.id, { where: "(Title,like,BulkUpsert%)" });
    const existing = (buRows.list || []).find((r) => r.Title === "BulkUpsertExisting");
    const created = (buRows.list || []).find((r) => r.Title === "BulkUpsertNew");
    assert(existing, "bulk-upsert should have updated existing row");
    assert(String(existing.Score) === "50", "bulk-upsert should have updated Score to 50");
    assert(created, "bulk-upsert should have created new row");
    // Cleanup
    for (const r of buRows.list || []) {
      try { deleteRow(primary.id, { Id: r.Id }); } catch { /* ignore */ }
    }
    report.bulkUpsert = { status: "passed" };
  } catch (err) {
    report.bulkUpsert = { status: "failed", error: err.message || String(err) };
    console.log("Bulk upsert tests failed:", report.bulkUpsert.error);
  }

  // =========================================================================
  // NEW: Request command tests
  // =========================================================================
  console.log("Testing request command...");
  try {
    // GET request with query
    const getBases = rawRequest("GET", "/api/v2/meta/bases", { query: { limit: "5" } });
    assert(getBases.list !== undefined, "request GET should return bases list");
    // GET single base
    const getBase2 = rawRequest("GET", `/api/v2/meta/bases/${BASE_ID}`);
    assert(getBase2.id === BASE_ID, "request GET base should return correct id");
    report.request = { status: "passed" };
  } catch (err) {
    report.request = { status: "failed", error: err.message || String(err) };
    console.log("Request tests failed:", report.request.error);
  }

  // =========================================================================
  // NEW: Meta endpoints tests
  // =========================================================================
  console.log("Testing meta endpoints...");
  try {
    const endpoints = metaEndpoints(BASE_ID);
    assert(Array.isArray(endpoints) && endpoints.length > 0, "meta endpoints should return a non-empty array");
    report.metaEndpoints = { status: "passed" };
  } catch (err) {
    report.metaEndpoints = { status: "failed", error: err.message || String(err) };
    console.log("Meta endpoints tests failed:", report.metaEndpoints.error);
  }

  // =========================================================================
  // NEW: Dynamic API command tests
  // =========================================================================
  console.log("Testing dynamic api commands...");
  try {
    const tag = findTableTagForName(swagger, tableA) || findTableTagForName(swagger, tableB);
    if (!tag) throw new Error("No table tag found in swagger for dynamic api test");
    const createOp = findCreateOpForTag(swagger, tag);
    if (!createOp) throw new Error(`No create operation found for tag ${tag}`);
    const dynRow = createRowViaDynamic(BASE_ID, tag, createOp.operationId, { Title: "DynamicApiRow" });
    assert(dynRow.Id !== undefined, "dynamic api create should return an Id");
    // Cleanup
    const dynTableId = tableIdFromPath(createOp.urlPath);
    if (dynTableId) {
      try { deleteRow(dynTableId, { Id: dynRow.Id }); } catch { /* ignore */ }
    }
    report.dynamicApi = { status: "passed" };
  } catch (err) {
    report.dynamicApi = { status: "failed", error: err.message || String(err) };
    console.log("Dynamic api tests failed:", report.dynamicApi.error);
  }

  // =========================================================================
  // NEW: Storage upload via CLI command
  // =========================================================================
  console.log("Testing storage upload via CLI...");
  try {
    const tmpFile = path.join(ROOT, "scripts", `upload-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "nocodb-cli e2e upload test", "utf8");
    const uploadResult = storageUpload(tmpFile);
    assert(uploadResult !== undefined, "storage upload should return a result");
    report.storageUpload = { status: "passed" };
  } catch (err) {
    report.storageUpload = { status: "failed", error: err.message || String(err) };
    console.log("Storage upload tests failed:", report.storageUpload.error);
  }

  console.log("Cleanup...");
  deleteRow(primary.id, { Id: rowA.Id });
  deleteRow(secondary.id, { Id: rowB.Id });
  try {
    const formulaRow = createRow(formulaTable.id, { Title: "FormulaRow", Score: 2 });
    deleteRow(formulaTable.id, { Id: formulaRow.Id });
  } catch {
    // ignore
  }
  try {
    deleteRow(typeTable.id, { Id: typeRow.Id });
  } catch {
    // ignore
  }

  if (!KEEP) {
    runCli(["tables", "delete", primary.id]);
    runCli(["tables", "delete", secondary.id]);
    runCli(["tables", "delete", formulaTable.id]);
    runCli(["tables", "delete", typeTable.id]);
  }

  const colPassed = report.columns.filter((c) => c.status === "passed").length;
  const colFailed = report.columns.filter((c) => c.status === "failed").length;
  const colSkipped = report.columns.filter((c) => c.status === "skipped").length;
  const linkPassed = report.links.filter((l) => l.status === "passed").length;
  const linkFailed = report.links.filter((l) => l.status === "failed").length;

  // Gather feature test results
  const featureTests = [
    "workspace", "bases", "tablesExtra", "views", "filters", "sorts",
    "upsert", "bulkOps", "bulkUpsert", "request", "metaEndpoints",
    "dynamicApi", "storageUpload",
  ];
  const featurePassed = featureTests.filter((k) => report[k]?.status === "passed").length;
  const featureFailed = featureTests.filter((k) => report[k]?.status === "failed").length;
  const featureSkipped = featureTests.filter((k) => !report[k]).length;

  report.summary = {
    columns: { passed: colPassed, failed: colFailed, skipped: colSkipped },
    links: { passed: linkPassed, failed: linkFailed },
    features: { passed: featurePassed, failed: featureFailed, skipped: featureSkipped },
  };
  report.finishedAt = new Date().toISOString();
  writeReport(report);
  writeReportMarkdown(report);
  console.log("E2E complete.");
}

function tagFromPath(swagger, pathValue) {
  const methods = swagger.paths?.[pathValue];
  if (!methods) return "default";
  const op = methods.get || methods.post || methods.delete || methods.patch;
  return op?.tags?.[0] || "default";
}

function findOperationId(swagger, pathValue, method) {
  const op = swagger.paths?.[pathValue]?.[method];
  if (!op?.operationId) {
    throw new Error(`Missing operationId for ${method.toUpperCase()} ${pathValue}`);
  }
  return op.operationId;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
