import http from "node:http";
import { describe, expect, it } from "vitest";
import { NocoClient } from "../src/index.js";

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "boom" }));
  });
  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describe("NocoClient error handling", () => {
  it("throws on non-2xx responses", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const client = new NocoClient({ baseUrl });
      await expect(client.request("GET", "/fail")).rejects.toThrow();
      const ok = await client.request("GET", "/ok");
      expect(ok).toEqual({ ok: true });
    } finally {
      server.close();
    }
  });
});
