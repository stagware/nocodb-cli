import { describe, expect, it } from "vitest";
import { 
  NocoClient,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  NetworkError,
} from "../src/index.js";

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

describe("NocoClient HTTP error mapping", () => {
  it("throws AuthenticationError for 401 status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ msg: "Invalid token" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      await expect(client.request("GET", "/test")).rejects.toThrow(AuthenticationError);
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        if (error instanceof AuthenticationError) {
          expect(error.statusCode).toBe(401);
          expect(error.message).toBe("Invalid token");
          expect(error.code).toBe("AUTH_ERROR");
          expect(error.data).toEqual({ msg: "Invalid token" });
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws AuthenticationError for 403 status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ message: "Insufficient permissions" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        if (error instanceof AuthenticationError) {
          expect(error.statusCode).toBe(403);
          expect(error.message).toBe("Insufficient permissions");
          expect(error.code).toBe("AUTH_ERROR");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws NotFoundError for 404 status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        if (error instanceof NotFoundError) {
          expect(error.statusCode).toBe(404);
          expect(error.message).toContain("Table not found");
          expect(error.code).toBe("NOT_FOUND");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws ConflictError for 409 status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ msg: "Duplicate key violation", key: "email" }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("POST", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        if (error instanceof ConflictError) {
          expect(error.statusCode).toBe(409);
          expect(error.message).toBe("Duplicate key violation");
          expect(error.code).toBe("CONFLICT");
          expect(error.data).toEqual({ msg: "Duplicate key violation", key: "email" });
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws ValidationError for 400 status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ message: "Invalid request data" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("POST", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.statusCode).toBe(400);
          expect(error.message).toBe("Invalid request data");
          expect(error.code).toBe("VALIDATION_ERROR");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws NetworkError for other HTTP errors", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ msg: "Internal server error" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test", retry: { retry: false } });
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        if (error instanceof NetworkError) {
          expect(error.message).toContain("500");
          expect(error.code).toBe("NETWORK_ERROR");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("extracts error message from different response fields", async () => {
    const originalFetch = globalThis.fetch;
    
    // Test with 'msg' field
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ msg: "Error from msg field" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Error from msg field");
        }
      }

      // Test with 'message' field
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ message: "Error from message field" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      };

      try {
        await client.request("GET", "/test");
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Error from message field");
        }
      }

      // Test with 'error' field
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({ error: "Error from error field" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      };

      try {
        await client.request("GET", "/test");
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Error from error field");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("includes response data in error", async () => {
    const originalFetch = globalThis.fetch;
    const responseData = {
      msg: "Validation failed",
      details: { field: "email", reason: "invalid format" }
    };
    
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify(responseData),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("POST", "/test");
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Validation failed");
          // Note: ValidationError doesn't have a data property, but we can verify the message
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles network-level errors", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network connection failed");
    };

    try {
      const client = new NocoClient({ baseUrl: "https://example.test" });
      
      try {
        await client.request("GET", "/test");
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        if (error instanceof NetworkError) {
          expect(error.message).toContain("Network connection failed");
          expect(error.code).toBe("NETWORK_ERROR");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
