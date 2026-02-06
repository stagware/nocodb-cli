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
});
