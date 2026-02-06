import { describe, expect, it, vi, beforeEach } from "vitest";
import { NocoClient, DataApi } from "../src/index.js";

describe("DataApi", () => {
  let client: NocoClient;
  let api: DataApi;

  beforeEach(() => {
    client = new NocoClient({ baseUrl: "http://test" });
    api = new DataApi(client);
  });

  it("listLinks calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({ list: [] });
    await api.listLinks("t1", "f1", "r1", { limit: 10 });
    expect(spy).toHaveBeenCalledWith(
      "GET",
      "/api/v2/tables/t1/links/f1/records/r1",
      { query: { limit: 10 } }
    );
  });

  it("linkRecords calls correct endpoint with body", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
    const body = [{ Id: 1 }];
    await api.linkRecords("t1", "f1", "r1", body);
    expect(spy).toHaveBeenCalledWith(
      "POST",
      "/api/v2/tables/t1/links/f1/records/r1",
      { body }
    );
  });

  it("unlinkRecords calls correct endpoint with body", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
    const body = [{ Id: 1 }];
    await api.unlinkRecords("t1", "f1", "r1", body);
    expect(spy).toHaveBeenCalledWith(
      "DELETE",
      "/api/v2/tables/t1/links/f1/records/r1",
      { body }
    );
  });

  describe("Error handling", () => {
    it("handles listLinks failure", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Network Error"));
      await expect(api.listLinks("t1", "f1", "r1")).rejects.toThrow("Network Error");
    });

    it("handles linkRecords failure", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("POST Error"));
      await expect(api.linkRecords("t1", "f1", "r1", [])).rejects.toThrow("POST Error");
    });

    it("handles unlinkRecords failure", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("DELETE Error"));
      await expect(api.unlinkRecords("t1", "f1", "r1", [])).rejects.toThrow("DELETE Error");
    });
  });
});
