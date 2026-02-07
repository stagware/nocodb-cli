import { describe, it, expect } from "vitest";
import {
  findOperation,
  extractOperations,
  listEndpoints,
  validateRequestBody,
  getPathParamNames,
  applyPathParams,
  isHttpMethod,
  isSwaggerDoc,
  slugify,
  type SwaggerDoc,
  type Operation,
} from "../src/utils/swagger.js";

describe("findOperation", () => {
  const mockSwagger: SwaggerDoc = {
    paths: {
      "/api/v2/tables/{tableId}/records": {
        get: {
          operationId: "listRecords",
          tags: ["data"],
          parameters: [{ name: "tableId", in: "path", required: true }],
        },
        post: {
          operationId: "createRecord",
          tags: ["data"],
          requestBody: { required: true },
        },
      },
    },
  };

  it("should find operation by method and path", () => {
    const op = findOperation(mockSwagger, "get", "/api/v2/tables/{tableId}/records");
    expect(op).toBeDefined();
    expect(op?.operationId).toBe("listRecords");
    expect(op?.method).toBe("get");
  });

  it("should handle case-insensitive method", () => {
    const op = findOperation(mockSwagger, "GET", "/api/v2/tables/{tableId}/records");
    expect(op).toBeDefined();
    expect(op?.operationId).toBe("listRecords");
  });

  it("should return undefined for non-existent path", () => {
    const op = findOperation(mockSwagger, "get", "/non/existent/path");
    expect(op).toBeUndefined();
  });

  it("should return undefined for non-existent method", () => {
    const op = findOperation(mockSwagger, "delete", "/api/v2/tables/{tableId}/records");
    expect(op).toBeUndefined();
  });

  it("should include method and path in result", () => {
    const op = findOperation(mockSwagger, "post", "/api/v2/tables/{tableId}/records");
    expect(op?.method).toBe("post");
    expect(op?.path).toBe("/api/v2/tables/{tableId}/records");
  });
});

describe("extractOperations", () => {
  const mockSwagger: SwaggerDoc = {
    paths: {
      "/api/v2/bases": {
        get: { operationId: "listBases" },
        post: { operationId: "createBase" },
      },
      "/api/v2/bases/{baseId}": {
        get: { operationId: "getBase" },
        patch: { operationId: "updateBase" },
        delete: { operationId: "deleteBase" },
      },
    },
  };

  it("should extract all operations", () => {
    const ops = extractOperations(mockSwagger);
    expect(ops).toHaveLength(5);
  });

  it("should include method and path for each operation", () => {
    const ops = extractOperations(mockSwagger);
    const getBasesOp = ops.find((op) => op.operationId === "listBases");
    expect(getBasesOp?.method).toBe("get");
    expect(getBasesOp?.path).toBe("/api/v2/bases");
  });

  it("should handle empty swagger doc", () => {
    const ops = extractOperations({});
    expect(ops).toHaveLength(0);
  });

  it("should ignore non-HTTP methods", () => {
    const swagger: SwaggerDoc = {
      paths: {
        "/api/v2/test": {
          get: { operationId: "test" },
          parameters: [] as any, // Non-HTTP method property
        },
      },
    };
    const ops = extractOperations(swagger);
    expect(ops).toHaveLength(1);
    expect(ops[0].operationId).toBe("test");
  });
});

describe("listEndpoints", () => {
  const mockSwagger: SwaggerDoc = {
    paths: {
      "/api/v2/bases": {
        get: { tags: ["meta"] },
        post: { tags: ["meta"] },
      },
      "/api/v2/tables/{tableId}/records": {
        get: { tags: ["data"] },
        post: { tags: ["data"] },
      },
    },
  };

  it("should list all endpoints", () => {
    const endpoints = listEndpoints(mockSwagger);
    expect(endpoints).toHaveLength(4);
    expect(endpoints).toContain("GET /api/v2/bases");
    expect(endpoints).toContain("POST /api/v2/bases");
  });

  it("should filter by tag", () => {
    const endpoints = listEndpoints(mockSwagger, "meta");
    expect(endpoints).toHaveLength(2);
    expect(endpoints).toContain("GET /api/v2/bases");
    expect(endpoints).toContain("POST /api/v2/bases");
  });

  it("should return sorted endpoints", () => {
    const endpoints = listEndpoints(mockSwagger);
    const sorted = [...endpoints].sort();
    expect(endpoints).toEqual(sorted);
  });

  it("should handle empty swagger doc", () => {
    const endpoints = listEndpoints({});
    expect(endpoints).toHaveLength(0);
  });

  it("should uppercase HTTP methods", () => {
    const endpoints = listEndpoints(mockSwagger);
    endpoints.forEach((endpoint) => {
      const method = endpoint.split(" ")[0];
      expect(method).toMatch(/^[A-Z]+$/);
    });
  });
});

describe("validateRequestBody", () => {
  const mockSwagger: SwaggerDoc = {
    paths: {},
    definitions: {},
  };

  it("should pass validation when no schema defined", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
    };
    expect(() => validateRequestBody(op, mockSwagger, { data: "test" })).not.toThrow();
  });

  it("should throw error when required body is missing", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      },
    };
    expect(() => validateRequestBody(op, mockSwagger, undefined)).toThrow(
      "Request body is required for this operation."
    );
  });

  it("should pass validation for valid body", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
      },
    };
    expect(() => validateRequestBody(op, mockSwagger, { name: "test" })).not.toThrow();
  });

  it("should throw error for invalid body", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
      },
    };
    expect(() => validateRequestBody(op, mockSwagger, { age: 30 })).toThrow(
      "Request body does not match schema"
    );
  });

  it("should handle optional body", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      },
    };
    expect(() => validateRequestBody(op, mockSwagger, undefined)).not.toThrow();
  });

  it("should handle body parameter in parameters array", () => {
    const op: Operation = {
      method: "post",
      path: "/test",
      parameters: [
        {
          name: "body",
          in: "body",
          required: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
      ],
    };
    expect(() => validateRequestBody(op, mockSwagger, { name: "test" })).not.toThrow();
  });
});

describe("getPathParamNames", () => {
  it("should extract single parameter", () => {
    const names = getPathParamNames("/api/v2/bases/{baseId}");
    expect(names).toEqual(["baseId"]);
  });

  it("should extract multiple parameters", () => {
    const names = getPathParamNames("/api/v2/tables/{tableId}/records/{recordId}");
    expect(names).toEqual(["tableId", "recordId"]);
  });

  it("should return empty array for no parameters", () => {
    const names = getPathParamNames("/api/v2/bases");
    expect(names).toEqual([]);
  });

  it("should handle adjacent parameters", () => {
    const names = getPathParamNames("/api/{version}/{resource}");
    expect(names).toEqual(["version", "resource"]);
  });
});

describe("applyPathParams", () => {
  it("should replace single parameter", () => {
    const result = applyPathParams("/api/v2/bases/{baseId}", ["baseId"], ["base123"]);
    expect(result).toBe("/api/v2/bases/base123");
  });

  it("should replace multiple parameters", () => {
    const result = applyPathParams(
      "/api/v2/tables/{tableId}/records/{recordId}",
      ["tableId", "recordId"],
      ["tbl123", "rec456"]
    );
    expect(result).toBe("/api/v2/tables/tbl123/records/rec456");
  });

  it("should URL-encode parameter values", () => {
    const result = applyPathParams("/api/v2/bases/{baseId}", ["baseId"], ["base with spaces"]);
    expect(result).toBe("/api/v2/bases/base%20with%20spaces");
  });

  it("should throw error for missing parameter", () => {
    expect(() => applyPathParams("/api/v2/bases/{baseId}", ["baseId"], [])).toThrow(
      "Missing path parameter: baseId"
    );
  });

  it("should handle empty parameter value", () => {
    expect(() => applyPathParams("/api/v2/bases/{baseId}", ["baseId"], [""])).toThrow(
      "Missing path parameter: baseId"
    );
  });
});

describe("isHttpMethod", () => {
  it("should return true for valid HTTP methods", () => {
    expect(isHttpMethod("get")).toBe(true);
    expect(isHttpMethod("post")).toBe(true);
    expect(isHttpMethod("put")).toBe(true);
    expect(isHttpMethod("patch")).toBe(true);
    expect(isHttpMethod("delete")).toBe(true);
    expect(isHttpMethod("head")).toBe(true);
    expect(isHttpMethod("options")).toBe(true);
  });

  it("should handle uppercase methods", () => {
    expect(isHttpMethod("GET")).toBe(true);
    expect(isHttpMethod("POST")).toBe(true);
  });

  it("should return false for invalid methods", () => {
    expect(isHttpMethod("invalid")).toBe(false);
    expect(isHttpMethod("connect")).toBe(false);
    expect(isHttpMethod("trace")).toBe(false);
  });
});

describe("isSwaggerDoc", () => {
  it("should return true for valid swagger doc", () => {
    const doc = { paths: {} };
    expect(isSwaggerDoc(doc)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isSwaggerDoc(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isSwaggerDoc(undefined)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isSwaggerDoc("string")).toBe(false);
    expect(isSwaggerDoc(123)).toBe(false);
  });

  it("should return false for object without paths", () => {
    expect(isSwaggerDoc({ other: "property" })).toBe(false);
  });
});

describe("slugify", () => {
  it("should convert to lowercase", () => {
    expect(slugify("MyTableName")).toBe("mytablename");
  });

  it("should replace spaces with hyphens", () => {
    expect(slugify("My Table Name")).toBe("my-table-name");
  });

  it("should replace special characters with hyphens", () => {
    expect(slugify("My@Table#Name")).toBe("my-table-name");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(slugify("--my-table--")).toBe("my-table");
  });

  it("should handle multiple consecutive special characters", () => {
    expect(slugify("my!!!table")).toBe("my-table");
  });

  it("should preserve numbers", () => {
    expect(slugify("Table123")).toBe("table123");
  });

  it("should handle empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("should handle string with only special characters", () => {
    expect(slugify("@#$%")).toBe("");
  });
});
