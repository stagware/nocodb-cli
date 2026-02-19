import { describe, expect, it } from "vitest";
import {
  applyPathParams,
  extractOperations,
  findOperation,
  getPathParamNames,
  isHttpMethod,
  isSwaggerDoc,
  listEndpoints,
  slugify,
  validateRequestBody,
  type SwaggerDoc,
} from "../src/utils/swagger.js";
import { formatCsv, formatTable } from "../src/utils/formatting.js";
import { parseKeyValue, getBaseIdFromArgv } from "../src/utils/parsing.js";

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

describe("formatCsv", () => {
  it("formats an array of objects as CSV", () => {
    const data = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    expect(formatCsv(data)).toBe("id,name\n1,Alice\n2,Bob");
  });

  it("unwraps NocoDB list envelope", () => {
    const data = { list: [{ id: "1" }, { id: "2" }], pageInfo: {} };
    expect(formatCsv(data)).toBe("id\n1\n2");
  });

  it("treats a single object as one row", () => {
    expect(formatCsv({ a: 1, b: 2 })).toBe("a,b\n1,2");
  });

  it("escapes commas and quotes per RFC 4180", () => {
    const data = [{ val: 'has, comma' }, { val: 'has "quote"' }];
    expect(formatCsv(data)).toBe('val\n"has, comma"\n"has ""quote"""');
  });

  it("handles empty array", () => {
    expect(formatCsv([])).toBe("");
  });

  it("handles rows with different keys", () => {
    const data = [{ a: 1 }, { b: 2 }];
    const csv = formatCsv(data);
    expect(csv).toBe("a,b\n1,\n,2");
  });
});

describe("formatTable", () => {
  it("formats an array of objects as an ASCII table", () => {
    const data = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const result = formatTable(data);
    const lines = result.split("\n");
    expect(lines).toHaveLength(4); // header, separator, 2 data rows
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("name");
    expect(lines[1]).toMatch(/^\|-.*-\|$/);
    expect(lines[2]).toContain("1");
    expect(lines[2]).toContain("Alice");
  });

  it("unwraps NocoDB list envelope", () => {
    const data = { list: [{ x: "hello" }], pageInfo: {} };
    const result = formatTable(data);
    expect(result).toContain("x");
    expect(result).toContain("hello");
  });

  it("returns (empty) for empty array", () => {
    expect(formatTable([])).toBe("(empty)");
  });

  it("truncates long values", () => {
    const longVal = "a".repeat(50);
    const data = [{ col: longVal }];
    const result = formatTable(data);
    expect(result).toContain("...");
    expect(result).not.toContain(longVal);
  });
});

