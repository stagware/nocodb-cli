import fs from "node:fs";
import path from "node:path";
import { ofetch } from "ofetch";

export type HeadersMap = Record<string, string>;

export interface RetryOptions {
  retry?: number | false;
  retryDelay?: number;
  retryStatusCodes?: number[];
}

export interface RequestOptions {
  headers?: HeadersMap;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
  retry?: RetryOptions;
}

export interface ClientOptions {
  baseUrl: string;
  headers?: HeadersMap;
  timeoutMs?: number;
  retry?: RetryOptions;
}

export class NocoClient {
  private baseUrl: string;
  private headers: HeadersMap;
  private timeoutMs?: number;
  private retryOptions?: RetryOptions;

  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.headers = { ...(options.headers ?? {}) };
    this.timeoutMs = options.timeoutMs;
    this.retryOptions = options.retry;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  removeHeader(name: string): void {
    delete this.headers[name];
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const urlPath = path.startsWith("/") ? path : `/${path}`;
    const headers = { ...this.headers, ...(options.headers ?? {}) };
    const retry = options.retry ?? this.retryOptions;

    return ofetch<T>(urlPath, {
      baseURL: this.baseUrl,
      method,
      headers,
      query: options.query,
      body: options.body as unknown as Record<string, unknown> | BodyInit | null | undefined,
      timeout: options.timeoutMs ?? this.timeoutMs,
      retry: retry?.retry,
      retryDelay: retry?.retryDelay,
      retryStatusCodes: retry?.retryStatusCodes,
    });
  }
}

export interface BaseRef {
  id: string;
  title?: string;
}

export interface TableRef {
  id: string;
  title?: string;
}

export interface ViewRef {
  id: string;
  title?: string;
}

export interface FilterRef {
  id: string;
}

export interface SortRef {
  id: string;
}

export interface ColumnRef {
  id: string;
}

export class MetaApi {
  constructor(private client: NocoClient) {}

  listBases(): Promise<unknown> {
    return this.client.request("GET", "/api/v2/meta/bases");
  }

  createBase(body: unknown): Promise<unknown> {
    return this.client.request("POST", "/api/v2/meta/bases", { body });
  }

  getBase(baseId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/bases/${baseId}`);
  }

  getBaseInfo(baseId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/bases/${baseId}/info`);
  }

  updateBase(baseId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/bases/${baseId}`, { body });
  }

  deleteBase(baseId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/bases/${baseId}`);
  }

  listTables(baseId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/bases/${baseId}/tables`);
  }

  createTable(baseId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/meta/bases/${baseId}/tables`, { body });
  }

  getTable(tableId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/tables/${tableId}`);
  }

  updateTable(tableId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/tables/${tableId}`, { body });
  }

  deleteTable(tableId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/tables/${tableId}`);
  }

  listViews(tableId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/tables/${tableId}/views`);
  }

  createView(tableId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/meta/tables/${tableId}/views`, { body });
  }

  getView(viewId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/views/${viewId}`);
  }

  updateView(viewId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/views/${viewId}`, { body });
  }

  deleteView(viewId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/views/${viewId}`);
  }

  listViewFilters(viewId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/views/${viewId}/filters`);
  }

  createViewFilter(viewId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/meta/views/${viewId}/filters`, { body });
  }

  getFilter(filterId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/filters/${filterId}`);
  }

  updateFilter(filterId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/filters/${filterId}`, { body });
  }

  deleteFilter(filterId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/filters/${filterId}`);
  }

  listViewSorts(viewId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/views/${viewId}/sorts`);
  }

  createViewSort(viewId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/meta/views/${viewId}/sorts`, { body });
  }

  getSort(sortId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/sorts/${sortId}`);
  }

  updateSort(sortId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/sorts/${sortId}`, { body });
  }

  deleteSort(sortId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/sorts/${sortId}`);
  }

  listColumns(tableId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/tables/${tableId}/columns`);
  }

  createColumn(tableId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/meta/tables/${tableId}/columns`, { body });
  }

  getColumn(columnId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/columns/${columnId}`);
  }

  updateColumn(columnId: string, body: unknown): Promise<unknown> {
    return this.client.request("PATCH", `/api/v2/meta/columns/${columnId}`, { body });
  }

  deleteColumn(columnId: string): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/meta/columns/${columnId}`);
  }

  getBaseSwagger(baseId: string): Promise<unknown> {
    return this.client.request("GET", `/api/v2/meta/bases/${baseId}/swagger.json`);
  }

  async uploadAttachment(filePath: string): Promise<unknown> {
    const fileName = path.basename(filePath);
    const fileContent = await fs.promises.readFile(filePath);
    const boundary = `----nocodb-${Date.now()}`;
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), fileContent, Buffer.from(footer)]);
    return this.client.request("POST", "/api/v2/storage/upload", {
      body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
  }
}

export class DataApi {
  constructor(private client: NocoClient) {}

  listLinks(tableId: string, linkFieldId: string, recordId: string, query?: Record<string, any>): Promise<unknown> {
    return this.client.request("GET", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { query });
  }

  linkRecords(tableId: string, linkFieldId: string, recordId: string, body: unknown): Promise<unknown> {
    return this.client.request("POST", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { body });
  }

  unlinkRecords(tableId: string, linkFieldId: string, recordId: string, body: unknown): Promise<unknown> {
    return this.client.request("DELETE", `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`, { body });
  }
}

export function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

export function parseHeader(input: string): [string, string] {
  const idx = input.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
  }
  const name = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!name || !value) {
    throw new Error(`Invalid header '${input}'. Use 'Name: Value'.`);
  }
  return [name, value];
}
