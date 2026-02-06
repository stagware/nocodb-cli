import { describe, expect, it } from "vitest";
import { NocoClient } from "../src/index.js";

describe("NocoClient", () => {
  it("sends requests with base URL, query, and headers", async () => {
    const originalFetch = globalThis.fetch;
    let captured;
    globalThis.fetch = async (input, init) => {
      captured = { input, init };
      const body = JSON.stringify({ ok: true });
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    };

    try {
      const client = new NocoClient({
        baseUrl: "https://example.test/api/",
        headers: { "x-token": "abc" },
      });
      const result = await client.request("GET", "/ping", { query: { a: "1" } });
      expect(result).toEqual({ ok: true });
      const url = String(captured.input);
      expect(url).toContain("https://example.test/api/ping");
      expect(url).toContain("a=1");
      const headers = captured.init?.headers;
      if (headers instanceof Headers) {
        expect(headers.get("x-token")).toBe("abc");
      } else {
        expect(headers).toMatchObject({ "x-token": "abc" });
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("retries on failure and eventually succeeds", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Server Error", { status: 500, headers: { "content-type": "text/plain" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    };

    try {
      const client = new NocoClient({
        baseUrl: "https://example.test",
        retry: { retry: 2, retryDelay: 0, retryStatusCodes: [500] },
      });
      const result = await client.request("GET", "/test");
      expect(result).toEqual({ ok: true });
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not retry when retry is false", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response("Server Error", { status: 500, headers: { "content-type": "text/plain" } });
    };

    try {
      const client = new NocoClient({
        baseUrl: "https://example.test",
        retry: { retry: false },
      });
      await expect(client.request("GET", "/test")).rejects.toThrow();
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("per-request retry overrides client-level retry", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response("Server Error", { status: 500, headers: { "content-type": "text/plain" } });
    };

    try {
      const client = new NocoClient({
        baseUrl: "https://example.test",
        retry: { retry: 5, retryDelay: 0, retryStatusCodes: [500] },
      });
      await expect(
        client.request("GET", "/test", { retry: { retry: false } })
      ).rejects.toThrow();
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
