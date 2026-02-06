import Ajv from "ajv";

export type SwaggerDoc = {
  paths?: Record<string, Record<string, SwaggerOperation>>;
  definitions?: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
};

export type SwaggerOperation = {
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
};

export type SwaggerParameter = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: unknown;
};

export type SwaggerRequestBody = {
  required?: boolean;
  content?: Record<string, { schema?: unknown }>;
};

export type Operation = {
  method: string;
  path: string;
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
};

export function getBaseIdFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base" && argv[i + 1]) {
      return argv[i + 1];
    }
    if (arg.startsWith("--base=")) {
      return arg.slice("--base=".length);
    }
  }
  return undefined;
}

export function parseKeyValue(input: string): [string, string] {
  const idx = input.indexOf("=");
  if (idx === -1) {
    throw new Error(`Invalid value '${input}'. Use 'key=value'.`);
  }
  const key = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!key || !value) {
    throw new Error(`Invalid value '${input}'. Use 'key=value'.`);
  }
  return [key, value];
}

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

export function getPathParamNames(pathTemplate: string): string[] {
  const matches = pathTemplate.matchAll(/\{([^}]+)\}/g);
  return Array.from(matches, (match) => match[1]);
}

export function isHttpMethod(method: string): boolean {
  return ["get", "post", "put", "patch", "delete", "head", "options"].includes(method.toLowerCase());
}

export function isSwaggerDoc(doc: unknown): doc is SwaggerDoc {
  if (!doc || typeof doc !== "object") {
    return false;
  }
  return "paths" in (doc as Record<string, unknown>);
}

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

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
