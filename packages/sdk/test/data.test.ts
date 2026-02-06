import { describe, expect, it, vi } from "vitest";
import { NocoClient, DataApi } from "../src/index.js";

describe("DataApi", () => {
  it("listLinks calls correct endpoint", async () => {
    const client = new NocoClient({ baseUrl: "http://test" });
    const spy = vi.spyOn(client, "request").mockResolvedValue({ list: [] });
    const api = new DataApi(client);

    await api.listLinks("t1", "f1", "r1", { limit: 10 });

    expect(spy).toHaveBeenCalledWith(
      "GET",
      "/api/v2/tables/t1/links/f1/records/r1",
      { query: { limit: 10 } }
    );
  });

  it("linkRecords calls correct endpoint with body", async () => {
    const client = new NocoClient({ baseUrl: "http://test" });
    const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
    const api = new DataApi(client);
    const body = [{ Id: 1 }];

    await api.linkRecords("t1", "f1", "r1", body);

    expect(spy).toHaveBeenCalledWith(
      "POST",
      "/api/v2/tables/t1/links/f1/records/r1",
      { body }
    );
  });

  it("unlinkRecords calls correct endpoint with body", async () => {
    const client = new NocoClient({ baseUrl: "http://test" });
    const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
    const api = new DataApi(client);
    const body = [{ Id: 1 }];

    await api.unlinkRecords("t1", "f1", "r1", body);

    expect(spy).toHaveBeenCalledWith(
      "DELETE",
      "/api/v2/tables/t1/links/f1/records/r1",
      { body }
    );
  });

  describe("Error handling", () => {
    it("handles request failure", async () => {
      const client = new NocoClient({ baseUrl: "http://test" });
      vi.spyOn(client, "request").mockRejectedValue(new Error("Network Error"));
      const api = new DataApi(client);

      await expect(api.listLinks("t1", "f1", "r1")).rejects.toThrow("Network Error");
    });
  });
});
