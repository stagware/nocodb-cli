import { ofetch } from "ofetch";

export type HeadersMap = Record<string, string>;

export interface RequestOptions {
  headers?: HeadersMap;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export interface ClientOptions {
  baseUrl: string;
  headers?: HeadersMap;
  timeoutMs?: number;
}

export class NocoClient {
  private baseUrl: string;
  private headers: HeadersMap;
  private timeoutMs?: number;

  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.headers = { ...(options.headers ?? {}) };
    this.timeoutMs = options.timeoutMs;
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

    return ofetch<T>(urlPath, {
      baseURL: this.baseUrl,
      method,
      headers,
      query: options.query,
      body: options.body as unknown as Record<string, unknown> | BodyInit | null | undefined,
      timeout: options.timeoutMs ?? this.timeoutMs,
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
