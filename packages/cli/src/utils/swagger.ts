/**
 * Swagger utilities for API documentation and validation
 * @module utils/swagger
 */

import Ajv from "ajv";

/**
 * Swagger document structure
 */
export type SwaggerDoc = {
  paths?: Record<string, Record<string, SwaggerOperation>>;
  definitions?: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
};

/**
 * Swagger operation definition
 */
export type SwaggerOperation = {
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
};

/**
 * Swagger parameter definition
 */
export type SwaggerParameter = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: unknown;
};

/**
 * Swagger request body definition
 */
export type SwaggerRequestBody = {
  required?: boolean;
  content?: Record<string, { schema?: unknown }>;
};

/**
 * Operation with method and path information
 */
export type Operation = {
  method: string;
  path: string;
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
};

/**
 * Finds a specific operation in a Swagger document
 * @param doc - Swagger document to search
 * @param method - HTTP method (get, post, put, patch, delete)
 * @param pathValue - API path to find
 * @returns Operation if found, undefined otherwise
 * @example
 * ```typescript
 * const op = findOperation(swagger, "post", "/api/v2/tables/tbl123/records");
 * if (op) {
 *   console.log(op.operationId);
 * }
 * ```
 */
export function findOperation(doc: SwaggerDoc, method: string, pathValue: string): Operation | undefined {
  const pathItem = doc.paths?.[pathValue];
  if (!pathItem) {
    return undefined;
  }
  const op = pathItem[method.toLowerCase()];
  if (!op) {
    return undefined;
  }
  return { method: method.toLowerCase(), path: pathValue, ...op };
}

/**
 * Extracts all operations from a Swagger document
 * @param doc - Swagger document
 * @returns Array of all operations
 */
export function extractOperations(doc: SwaggerDoc): Operation[] {
  const ops: Operation[] = [];
  const paths = doc.paths ?? {};
  for (const [pathKey, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!isHttpMethod(method)) {
        continue;
      }
      ops.push({ method, path: pathKey, ...op });
    }
  }
  return ops;
}

/**
 * Lists all endpoints in a Swagger document, optionally filtered by tag
 * @param doc - Swagger document
 * @param tag - Optional tag to filter by
 * @returns Array of endpoint strings in format "METHOD /path"
 */
export function listEndpoints(doc: SwaggerDoc, tag?: string): string[] {
  const endpoints: string[] = [];
  const paths = doc.paths ?? {};
  for (const [urlPath, methods] of Object.entries(paths)) {
    for (const [method, info] of Object.entries(methods)) {
      if (!isHttpMethod(method)) {
        continue;
      }
      if (tag && !info.tags?.includes(tag)) {
        continue;
      }
      endpoints.push(`${method.toUpperCase()} ${urlPath}`);
    }
  }
  return endpoints.sort();
}

/**
 * Validates a request body against an operation's schema
 * @param op - Operation to validate against
 * @param doc - Swagger document containing schema definitions
 * @param body - Request body to validate
 * @throws {Error} If validation fails or required body is missing
 * @example
 * ```typescript
 * const op = findOperation(swagger, "post", "/api/v2/tables/tbl123/records");
 * if (op) {
 *   validateRequestBody(op, swagger, { title: "New Record" });
 * }
 * ```
 */
export function validateRequestBody(op: Operation, doc: SwaggerDoc, body: unknown): void {
  const { schema, required } = getBodySchema(op);
  if (!schema) {
    if (body !== undefined) {
      return;
    }
    return;
  }

  if (required && body === undefined) {
    throw new Error("Request body is required for this operation.");
  }

  if (body === undefined) {
    return;
  }

  const rootSchema = {
    ...(schema as Record<string, unknown>),
    definitions: doc.definitions,
    components: doc.components,
  };

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(rootSchema);
  const valid = validate(body);
  if (!valid) {
    const errors = validate.errors?.map((err) => `${err.instancePath || "/"} ${err.message}`).join("; ");
    throw new Error(`Request body does not match schema: ${errors ?? "invalid payload"}`);
  }
}

/**
 * Extracts body schema from an operation
 * @param op - Operation to extract schema from
 * @returns Object with schema and required flag
 */
function getBodySchema(op: Operation): { schema?: unknown; required: boolean } {
  if (op.requestBody?.content) {
    const jsonBody = op.requestBody.content["application/json"];
    return { schema: jsonBody?.schema, required: op.requestBody.required ?? false };
  }
  if (op.parameters) {
    const bodyParam = op.parameters.find((param) => param.in === "body");
    if (bodyParam) {
      return { schema: bodyParam.schema, required: bodyParam.required ?? false };
    }
  }
  return { schema: undefined, required: false };
}

/**
 * Extracts path parameter names from a path template
 * @param pathTemplate - Path template with parameters in {braces}
 * @returns Array of parameter names
 * @example
 * ```typescript
 * getPathParamNames("/api/v2/tables/{tableId}/records/{recordId}");
 * // Returns: ["tableId", "recordId"]
 * ```
 */
export function getPathParamNames(pathTemplate: string): string[] {
  const matches = pathTemplate.matchAll(/\{([^}]+)\}/g);
  return Array.from(matches, (match) => match[1]);
}

/**
 * Applies path parameters to a path template
 * @param pathTemplate - Path template with parameters in {braces}
 * @param names - Parameter names
 * @param values - Parameter values
 * @returns Path with parameters replaced
 * @throws {Error} If a required parameter is missing
 * @example
 * ```typescript
 * applyPathParams("/api/v2/tables/{tableId}/records", ["tableId"], ["tbl123"]);
 * // Returns: "/api/v2/tables/tbl123/records"
 * ```
 */
export function applyPathParams(pathTemplate: string, names: string[], values: string[]): string {
  let pathValue = pathTemplate;
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const value = values[i];
    if (!value) {
      throw new Error(`Missing path parameter: ${name}`);
    }
    pathValue = pathValue.replace(`{${name}}`, encodeURIComponent(value));
  }
  return pathValue;
}

/**
 * Checks if a string is a valid HTTP method
 * @param method - String to check
 * @returns True if valid HTTP method
 */
export function isHttpMethod(method: string): boolean {
  return ["get", "post", "put", "patch", "delete", "head", "options"].includes(method.toLowerCase());
}

/**
 * Type guard to check if an object is a Swagger document
 * @param doc - Object to check
 * @returns True if object is a Swagger document
 */
export function isSwaggerDoc(doc: unknown): doc is SwaggerDoc {
  if (!doc || typeof doc !== "object") {
    return false;
  }
  return "paths" in (doc as Record<string, unknown>);
}

/**
 * Converts a string to a URL-friendly slug
 * @param input - String to slugify
 * @returns Slugified string
 * @example
 * ```typescript
 * slugify("My Table Name");
 * // Returns: "my-table-name"
 * ```
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
