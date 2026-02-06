import { describe, expect, it } from "vitest";
import {
  applyPathParams,
  extractOperations,
  findOperation,
  getPathParamNames,
  isHttpMethod,
  isSwaggerDoc,
  listEndpoints,
  parseKeyValue,
  slugify,
  getBaseIdFromArgv,
  validateRequestBody,
  type SwaggerDoc,
} from "../src/lib.js";

describe("parseKeyValue", () => {
  it("parses key=value pairs", () => {
    expect(parseKeyValue("a=b")).toEqual(["a", "b"]);
  });

  it("rejects invalid pairs", () => {
    expect(() => parseKeyValue("missing")).toThrow("Invalid value");
    expect(() => parseKeyValue("a=")).toThrow("Invalid value");
  });
});

describe("slugify", () => {
  it("converts to kebab-case", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });
});

describe("getBaseIdFromArgv", () => {
  it("finds base id from argv", () => {
    expect(getBaseIdFromArgv(["node", "cli", "--base", "abc"])).toBe("abc");
    expect(getBaseIdFromArgv(["node", "cli", "--base=xyz"])).toBe("xyz");
  });
});

describe("applyPathParams", () => {
  it("applies encoded path params", () => {
    const path = applyPathParams("/api/{id}/items/{name}", ["id", "name"], ["1", "A/B"]);
    expect(path).toBe("/api/1/items/A%2FB");
  });
});

describe("swagger helpers", () => {
  const doc: SwaggerDoc = {
    paths: {
      "/api/v2/meta/bases": {
        get: { tags: ["Bases"], operationId: "bases-list" },
      },
      "/api/v2/tables/{tableId}/records": {
        post: { tags: ["Table"], operationId: "table-create" },
      },
    },
  };

  it("lists endpoints with filters", () => {
    expect(listEndpoints(doc)).toEqual([
      "GET /api/v2/meta/bases",
      "POST /api/v2/tables/{tableId}/records",
    ]);
    expect(listEndpoints(doc, "Bases")).toEqual(["GET /api/v2/meta/bases"]);
  });

  it("extracts operations", () => {
    const ops = extractOperations(doc);
    expect(ops).toHaveLength(2);
    expect(ops[0].path).toContain("/api/v2");
  });

  it("finds operations", () => {
    const op = findOperation(doc, "post", "/api/v2/tables/{tableId}/records");
    expect(op?.operationId).toBe("table-create");
  });

  it("handles path params", () => {
    expect(getPathParamNames("/a/{id}/b/{name}")).toEqual(["id", "name"]);
  });

  it("detects http methods", () => {
    expect(isHttpMethod("GET")).toBe(true);
    expect(isHttpMethod("TRACE")).toBe(false);
  });

  it("detects swagger docs", () => {
    expect(isSwaggerDoc(doc)).toBe(true);
    expect(isSwaggerDoc({})).toBe(false);
  });

  it("validates request bodies", () => {
    const op = {
      method: "post",
      path: "/api/v2/test",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["Name"],
              properties: {
                Name: { type: "string" },
              },
            },
          },
        },
      },
    };
    expect(() => validateRequestBody(op, doc, { Name: "ok" })).not.toThrow();
    expect(() => validateRequestBody(op, doc, { Wrong: "nope" })).toThrow("Request body does not match schema");
  });
});
