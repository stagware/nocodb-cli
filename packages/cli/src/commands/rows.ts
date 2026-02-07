import { Command } from "commander";
import { NocoClient } from "@nocodb/sdk";
import { resolveNamespacedAlias, type MultiConfig } from "../aliases.js";
import { findOperation, parseKeyValue, validateRequestBody, type SwaggerDoc } from "../lib.js";
import { addJsonInputOptions, addOutputOptions, withErrorHandler } from "./helpers.js";

type PrintOptions = { pretty?: boolean; format?: string };

export interface RegisterRowsCommandsDeps {
  program: Command;
  collect: (value: string, previous: string[]) => string[];
  parseQuery: (items: string[]) => Record<string, string>;
  readJsonInput: (data?: string, dataFile?: string) => Promise<unknown>;
  printResult: (result: unknown, options?: PrintOptions | boolean) => void;
  handleError: (err: unknown) => void;
  loadSwagger: (baseId: string, useCache: boolean) => Promise<SwaggerDoc>;
  ensureSwaggerCache: (baseId: string) => Promise<void>;
  clientOptionsFromSettings: () => {
    timeoutMs: number;
    retry: {
      retry: number | false;
      retryDelay: number;
      retryStatusCodes: number[];
    };
  };
  getBaseId: (fallback?: string) => string;
  getBaseIdFromArgv: () => string | undefined;
  getBaseUrl: () => string;
  getHeadersConfig: () => Record<string, string>;
  getActiveWorkspaceName: () => string | undefined;
  getMultiConfig: () => MultiConfig;
}

export function registerRowsCommands({
  program,
  collect,
  parseQuery,
  readJsonInput,
  printResult,
  handleError,
  loadSwagger,
  ensureSwaggerCache,
  clientOptionsFromSettings,
  getBaseId,
  getBaseIdFromArgv,
  getBaseUrl,
  getHeadersConfig,
  getActiveWorkspaceName,
  getMultiConfig,
}: RegisterRowsCommandsDeps): void {
  const rowsCmd = program.command("rows").description("Table row CRUD (base-scoped)");

  const createClientForTable = (tableId: string) => {
    const resolved = resolveNamespacedAlias(tableId, getMultiConfig(), getActiveWorkspaceName());
    const client = new NocoClient({
      baseUrl: resolved.workspace?.baseUrl ?? getBaseUrl(),
      headers: resolved.workspace?.headers ?? getHeadersConfig(),
      ...clientOptionsFromSettings(),
    });
    return { client, resolvedTableId: resolved.id };
  };

  addOutputOptions(
    rowsCmd
      .command("list")
      .argument("tableId", "Table id")
      .option("-q, --query <key=value>", "Query string parameter", collect, []),
  ).action(withErrorHandler(handleError, async (
    tableId: string,
    options: { query: string[]; pretty?: boolean; format?: string },
  ) => {
    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const query = parseQuery(options.query ?? []);
    const result = await client.request("GET", `/api/v2/tables/${resolvedTableId}/records`, {
      query: Object.keys(query).length ? query : undefined,
    });
    printResult(result, options);
    await ensureSwaggerCache(baseId);
  }));

  addOutputOptions(
    rowsCmd
      .command("read")
      .argument("tableId", "Table id")
      .argument("recordId", "Record id")
      .option("-q, --query <key=value>", "Query string parameter", collect, []),
  ).action(withErrorHandler(handleError, async (
    tableId: string,
    recordId: string,
    options: { query: string[]; pretty?: boolean; format?: string },
  ) => {
    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const query = parseQuery(options.query ?? []);
    const result = await client.request("GET", `/api/v2/tables/${resolvedTableId}/records/${recordId}`, {
      query: Object.keys(query).length ? query : undefined,
    });
    printResult(result, options);
    await ensureSwaggerCache(baseId);
  }));

  addOutputOptions(addJsonInputOptions(rowsCmd.command("create").argument("tableId", "Table id"))).action(
    withErrorHandler(handleError, async (
      tableId: string,
      options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
    ) => {
      const { client, resolvedTableId } = createClientForTable(tableId);
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "post", `/api/v2/tables/${resolvedTableId}/records`);
      if (op) validateRequestBody(op, swagger, body);
      const result = await client.request("POST", `/api/v2/tables/${resolvedTableId}/records`, { body });
      printResult(result, options);
    }),
  );

  addOutputOptions(addJsonInputOptions(
    rowsCmd.command("bulk-create").argument("tableId", "Table id"),
    "Request JSON body (array of row objects)",
  )).action(withErrorHandler(handleError, async (
    tableId: string,
    options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
  ) => {
    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const body = await readJsonInput(options.data, options.dataFile);
    const rows = expectRecordArray(body, "rows bulk-create expects a JSON array of row objects");
    const swagger = await loadSwagger(baseId, true);
    const op = findOperation(swagger, "post", `/api/v2/tables/${resolvedTableId}/records`);
    if (op) validateRequestBody(op, swagger, rows);
    const result = await client.request("POST", `/api/v2/tables/${resolvedTableId}/records`, { body: rows });
    printResult(result, options);
  }));

  addOutputOptions(addJsonInputOptions(rowsCmd.command("update").argument("tableId", "Table id"))).action(
    withErrorHandler(handleError, async (
      tableId: string,
      options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
    ) => {
      const { client, resolvedTableId } = createClientForTable(tableId);
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "patch", `/api/v2/tables/${resolvedTableId}/records`);
      if (op) validateRequestBody(op, swagger, body);
      const result = await client.request("PATCH", `/api/v2/tables/${resolvedTableId}/records`, { body });
      printResult(result, options);
    }),
  );

  addOutputOptions(addJsonInputOptions(
    rowsCmd.command("bulk-update").argument("tableId", "Table id"),
    "Request JSON body (array of row objects with Id)",
  )).action(withErrorHandler(handleError, async (
    tableId: string,
    options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
  ) => {
    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const body = await readJsonInput(options.data, options.dataFile);
    const rows = expectRecordArray(body, "rows bulk-update expects a JSON array of row objects");
    const swagger = await loadSwagger(baseId, true);
    const op = findOperation(swagger, "patch", `/api/v2/tables/${resolvedTableId}/records`);
    if (op) validateRequestBody(op, swagger, rows);
    const result = await client.request("PATCH", `/api/v2/tables/${resolvedTableId}/records`, { body: rows });
    printResult(result, options);
  }));

  addOutputOptions(
    addJsonInputOptions(rowsCmd.command("upsert").argument("tableId", "Table id"))
      .requiredOption("--match <field=value>", "Field/value matcher used to find an existing row")
      .option("-q, --query <key=value>", "Query string parameter", collect, [])
      .option("--create-only", "Only create, fail if a matching row exists")
      .option("--update-only", "Only update, fail if no matching row exists"),
  ).action(withErrorHandler(handleError, async (tableId: string, options: {
    match: string;
    data?: string;
    dataFile?: string;
    query: string[];
    createOnly?: boolean;
    updateOnly?: boolean;
    pretty?: boolean;
    format?: string;
  }) => {
    if (options.createOnly && options.updateOnly) {
      throw new Error("Choose only one of --create-only or --update-only");
    }

    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const [matchField, matchValue] = parseKeyValue(options.match);
    const body = await readJsonInput(options.data, options.dataFile);
    if (!isRecordObject(body)) throw new Error("rows upsert expects a JSON object body");

    const query = parseQuery(options.query ?? []);
    const swagger = await loadSwagger(baseId, true);
    const createOp = findOperation(swagger, "post", `/api/v2/tables/${resolvedTableId}/records`);
    if (createOp) validateRequestBody(createOp, swagger, body);

    const listPath = `/api/v2/tables/${resolvedTableId}/records`;
    const listResult = await client.request<unknown>("GET", listPath, {
      query: Object.keys(query).length ? query : undefined,
    });

    const rows = extractRows(listResult);
    const matches = rows.filter((row) => matchesFieldValue(row, matchField, matchValue));
    if (matches.length > 1) throw new Error(`Multiple rows matched '${matchField}=${matchValue}'. Upsert requires a unique match.`);

    const runUpdate = async (record: Record<string, unknown>) => {
      const recordId = getRecordId(record);
      const updateBody = withRecordId(body, recordId);
      const updateOp = findOperation(swagger, "patch", `/api/v2/tables/${resolvedTableId}/records`);
      if (updateOp) validateRequestBody(updateOp, swagger, updateBody);
      return client.request("PATCH", listPath, { body: updateBody });
    };

    if (matches.length === 0) {
      if (options.updateOnly) throw new Error(`No rows matched '${matchField}=${matchValue}'.`);
      try {
        const created = await client.request("POST", listPath, { body });
        printResult(created, options);
        return;
      } catch (err) {
        if (!options.createOnly && isConflictError(err)) {
          const retryList = await client.request<unknown>("GET", listPath, {
            query: Object.keys(query).length ? query : undefined,
          });
          const retryRows = extractRows(retryList);
          const retryMatches = retryRows.filter((row) => matchesFieldValue(row, matchField, matchValue));
          if (retryMatches.length === 1) {
            const updated = await runUpdate(retryMatches[0]);
            printResult(updated, options);
            return;
          }
        }
        throw err;
      }
    }

    if (options.createOnly) throw new Error(`A row already matched '${matchField}=${matchValue}'.`);
    const updated = await runUpdate(matches[0]);
    printResult(updated, options);
  }));

  addOutputOptions(
    addJsonInputOptions(
      rowsCmd
        .command("bulk-upsert")
        .argument("tableId", "Table id")
        .requiredOption("--match <field>", "Field name used to match existing rows")
        .option("-q, --query <key=value>", "Query string parameter", collect, [])
        .option("--create-only", "Only create, fail if a matching row exists")
        .option("--update-only", "Only update, fail if no matching row exists"),
      "Request JSON body (array of row objects)",
    ),
  ).action(withErrorHandler(handleError, async (tableId: string, options: {
    match: string;
    data?: string;
    dataFile?: string;
    query: string[];
    createOnly?: boolean;
    updateOnly?: boolean;
    pretty?: boolean;
    format?: string;
  }) => {
    if (options.createOnly && options.updateOnly) {
      throw new Error("Choose only one of --create-only or --update-only");
    }

    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const matchField = options.match;
    const body = await readJsonInput(options.data, options.dataFile);
    const incomingRows = expectRecordArray(body, "rows bulk-upsert expects a JSON array of row objects");

    const query = parseQuery(options.query ?? []);
    const swagger = await loadSwagger(baseId, true);
    const createOp = findOperation(swagger, "post", `/api/v2/tables/${resolvedTableId}/records`);
    const updateOp = findOperation(swagger, "patch", `/api/v2/tables/${resolvedTableId}/records`);
    if (createOp) validateRequestBody(createOp, swagger, incomingRows);

    const listPath = `/api/v2/tables/${resolvedTableId}/records`;
    const existingRows: Record<string, unknown>[] = [];
    let page = 1;
    const pageSize = 1000;

    while (true) {
      const listResult = await client.request<any>("GET", listPath, {
        query: { ...query, page: String(page), limit: String(pageSize) },
      });
      const pageRows = extractRows(listResult);
      existingRows.push(...pageRows);
      const totalRows = listResult?.pageInfo?.totalRows ?? 0;
      if (pageRows.length < pageSize || existingRows.length >= totalRows) break;
      page += 1;
    }

    const toCreate: Record<string, unknown>[] = [];
    const toUpdate: Record<string, unknown>[] = [];
    for (const row of incomingRows) {
      const matchValue = row[matchField];
      if (matchValue === undefined || matchValue === null) {
        if (options.updateOnly) throw new Error(`Row missing match field '${matchField}'.`);
        toCreate.push(row);
        continue;
      }
      const matches = existingRows.filter((ex) => matchesFieldValue(ex, matchField, String(matchValue)));
      if (matches.length > 1) {
        throw new Error(`Multiple rows matched '${matchField}=${matchValue}'. Bulk upsert requires unique matches.`);
      }
      if (matches.length === 1) {
        if (options.createOnly) throw new Error(`Row already exists for '${matchField}=${matchValue}'.`);
        toUpdate.push(withRecordId(row, getRecordId(matches[0])));
      } else {
        if (options.updateOnly) throw new Error(`No row matched '${matchField}=${matchValue}'.`);
        toCreate.push(row);
      }
    }

    const results: { created?: unknown; updated?: unknown } = {};
    if (toCreate.length > 0) results.created = await client.request("POST", listPath, { body: toCreate });
    if (toUpdate.length > 0) {
      if (updateOp) validateRequestBody(updateOp, swagger, toUpdate);
      results.updated = await client.request("PATCH", listPath, { body: toUpdate });
    }
    printResult(results, options);
  }));

  addOutputOptions(addJsonInputOptions(
    rowsCmd.command("bulk-delete").argument("tableId", "Table id"),
    "Request JSON body (array of row identifiers)",
  )).action(withErrorHandler(handleError, async (
    tableId: string,
    options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
  ) => {
    const { client, resolvedTableId } = createClientForTable(tableId);
    const baseId = getBaseId(getBaseIdFromArgv());
    const body = await readJsonInput(options.data, options.dataFile);
    const rows = expectRecordArray(body, "rows bulk-delete expects a JSON array body");
    const swagger = await loadSwagger(baseId, true);
    const op = findOperation(swagger, "delete", `/api/v2/tables/${resolvedTableId}/records`);
    if (op) validateRequestBody(op, swagger, rows);
    const result = await client.request("DELETE", `/api/v2/tables/${resolvedTableId}/records`, { body: rows });
    printResult(result, options);
  }));

  addOutputOptions(addJsonInputOptions(rowsCmd.command("delete").argument("tableId", "Table id"))).action(
    withErrorHandler(handleError, async (
      tableId: string,
      options: { data?: string; dataFile?: string; pretty?: boolean; format?: string },
    ) => {
      const { client, resolvedTableId } = createClientForTable(tableId);
      const baseId = getBaseId(getBaseIdFromArgv());
      const body = await readJsonInput(options.data, options.dataFile);
      const swagger = await loadSwagger(baseId, true);
      const op = findOperation(swagger, "delete", `/api/v2/tables/${resolvedTableId}/records`);
      if (op) validateRequestBody(op, swagger, body);
      const result = await client.request("DELETE", `/api/v2/tables/${resolvedTableId}/records`, { body });
      printResult(result, options);
    }),
  );
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function expectRecordArray(input: unknown, errorMessage: string): Record<string, unknown>[] {
  if (!Array.isArray(input)) throw new Error(errorMessage);
  const rows = input.filter(isRecordObject);
  if (rows.length !== input.length) throw new Error(errorMessage);
  return rows;
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecordObject);
  if (isRecordObject(payload) && Array.isArray(payload.list)) {
    const list = payload.list.filter(isRecordObject);
    if (list.length !== payload.list.length) {
      throw new Error("Unexpected row payload shape: list contains non-object values");
    }
    return list;
  }
  throw new Error("Unexpected rows list response shape");
}

function matchesFieldValue(row: Record<string, unknown>, field: string, expected: string): boolean {
  if (!(field in row)) return false;
  const value = row[field];
  if (value === null || value === undefined) return false;
  return String(value) === expected;
}

function getRecordId(row: Record<string, unknown>): string | number {
  const id = row.Id ?? row.id;
  if (typeof id === "string" || typeof id === "number") return id;
  throw new Error("Matched row does not contain a usable Id field");
}

function withRecordId(body: Record<string, unknown>, id: string | number): Record<string, unknown> {
  const incomingId = body.Id ?? body.id;
  if (incomingId !== undefined && incomingId !== null && String(incomingId) !== String(id)) {
    throw new Error(`Body Id '${String(incomingId)}' does not match matched record Id '${String(id)}'`);
  }
  return { ...body, Id: id };
}

function isConflictError(err: unknown): boolean {
  return err instanceof Error && typeof (err as { statusCode?: unknown }).statusCode === "number"
    && (err as { statusCode: number }).statusCode === 409;
}
