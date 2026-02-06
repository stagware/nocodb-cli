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
  for (const columns of columnSets) {
    const payload = tablePayload(name, columns);
    const tmp = path.join(ROOT, "scripts", `${name}.json`);
    writeJson(tmp, payload);
    try {
      const out = runCli(["tables", "create", baseId, "--data-file", tmp, "--pretty"]);
      return jsonParseOrThrow(out);
    } catch (err) {
      // try next column set
    }
  }
  throw new Error(`Failed to create table ${name} with provided column sets.`);
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
  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  console.log(`Report written to ${mdPath}`);
}

async function uploadAttachment(filePath) {
  const boundary = `----nocodbcli-${Date.now()}`;
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);
  const header =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    "Content-Type: application/octet-stream\r\n\r\n";
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(header, "utf8"), fileContent, Buffer.from(footer, "utf8")]);

  const res = await fetch(`${BASE_URL}/api/v2/storage/upload`, {
    method: "POST",
    headers: {
      "xc-token": TOKEN,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attachment upload failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function attemptColumnTest(tableId, rowId, columnDef, sampleValue, report) {

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
      const uploads = await uploadAttachment(tmpFile);
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
    await attemptColumnTest(typeTable.id, typeRow.Id, entry.def, entry.value, report);
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
  report.summary = {
    columns: { passed: colPassed, failed: colFailed, skipped: colSkipped },
    links: { passed: linkPassed, failed: linkFailed },
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
