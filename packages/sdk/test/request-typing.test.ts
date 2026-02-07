import { describe, expect, it } from "vitest";
import { NocoClient } from "../src/index.js";
import type { Base, ListResponse, Row } from "../src/index.js";

describe("NocoClient.request generic type parameters", () => {
  it("should return typed response for Base", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const body = JSON.stringify({
        id: "base123",
        title: "My Base",
        type: "database",
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      const result = await client.request<Base>("GET", "/api/v2/meta/bases/base123");

      // TypeScript should infer the correct type
      expect(result.id).toBe("base123");
      expect(result.title).toBe("My Base");
      expect(result.type).toBe("database");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should return typed response for ListResponse<Row>", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const body = JSON.stringify({
        list: [
          { Id: 1, name: "Alice", email: "alice@example.com" },
          { Id: 2, name: "Bob", email: "bob@example.com" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      const result = await client.request<ListResponse<Row>>(
        "GET",
        "/api/v2/tables/table123/records"
      );

      // TypeScript should infer the correct type
      expect(result.list).toHaveLength(2);
      expect(result.list[0].name).toBe("Alice");
      expect(result.pageInfo.totalRows).toBe(2);
      expect(result.pageInfo.isFirstPage).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should return typed response for Row", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const body = JSON.stringify({
        Id: 1,
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      const result = await client.request<Row>(
        "POST",
        "/api/v2/tables/table123/records",
        {
          body: { name: "John Doe", email: "john@example.com", age: 30 },
        }
      );

      // TypeScript should infer the correct type
      expect(result.Id).toBe(1);
      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
      expect(result.age).toBe(30);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle void responses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(null, {
        status: 204,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      const result = await client.request<void>("DELETE", "/api/v2/meta/bases/base123");

      // TypeScript should infer void type
      expect(result).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should allow unknown type when not specified", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const body = JSON.stringify({ arbitrary: "data", nested: { value: 123 } });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      const result = await client.request("GET", "/api/v2/custom/endpoint");

      // Without type parameter, result should be unknown
      expect(result).toEqual({ arbitrary: "data", nested: { value: 123 } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
