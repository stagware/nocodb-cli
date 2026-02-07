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

  describe("Typed responses", () => {
    it("listLinks returns typed ListResponse<Row>", async () => {
      const mockResponse = {
        list: [
          { Id: 1, name: "Record 1" },
          { Id: 2, name: "Record 2" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      // TypeScript should infer the correct type
      expect(result.list).toHaveLength(2);
      expect(result.list[0].Id).toBe(1);
      expect(result.pageInfo.totalRows).toBe(2);
    });

    it("listLinks handles empty list", async () => {
      const mockResponse = {
        list: [],
        pageInfo: {
          totalRows: 0,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      expect(result.list).toHaveLength(0);
      expect(result.pageInfo.totalRows).toBe(0);
    });

    it("listLinks handles rows with various field types", async () => {
      const mockResponse = {
        list: [
          {
            Id: 1,
            name: "Test",
            age: 30,
            active: true,
            metadata: { key: "value" },
            tags: ["tag1", "tag2"],
          },
        ],
        pageInfo: { totalRows: 1 },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      expect(result.list[0].Id).toBe(1);
      expect(result.list[0].name).toBe("Test");
      expect(result.list[0].age).toBe(30);
      expect(result.list[0].active).toBe(true);
      expect(result.list[0].metadata).toEqual({ key: "value" });
      expect(result.list[0].tags).toEqual(["tag1", "tag2"]);
    });

    it("listLinks handles rows with numeric Id", async () => {
      const mockResponse = {
        list: [
          { Id: 123, title: "Row 123" },
          { Id: 456, title: "Row 456" },
        ],
        pageInfo: { totalRows: 2 },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      expect(result.list[0].Id).toBe(123);
      expect(result.list[1].Id).toBe(456);
    });

    it("listLinks handles rows with string Id", async () => {
      const mockResponse = {
        list: [
          { Id: "rec_abc", title: "Row ABC" },
          { Id: "rec_xyz", title: "Row XYZ" },
        ],
        pageInfo: { totalRows: 2 },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      expect(result.list[0].Id).toBe("rec_abc");
      expect(result.list[1].Id).toBe("rec_xyz");
    });

    it("listLinks handles partial pageInfo", async () => {
      const mockResponse = {
        list: [{ Id: 1, name: "Test" }],
        pageInfo: { totalRows: 1 },
      };
      vi.spyOn(client, "request").mockResolvedValue(mockResponse);
      
      const result = await api.listLinks("t1", "f1", "r1");
      
      expect(result.pageInfo.totalRows).toBe(1);
      expect(result.pageInfo.page).toBeUndefined();
      expect(result.pageInfo.pageSize).toBeUndefined();
    });
  });

  describe("Additional error scenarios", () => {
    it("handles 404 error when link field not found", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Link field not found"));
      await expect(api.listLinks("t1", "invalid-field", "r1")).rejects.toThrow("Link field not found");
    });

    it("handles 404 error when record not found", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Record not found"));
      await expect(api.listLinks("t1", "f1", "invalid-record")).rejects.toThrow("Record not found");
    });

    it("handles authentication error in linkRecords", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Unauthorized"));
      await expect(api.linkRecords("t1", "f1", "r1", [{ Id: 1 }])).rejects.toThrow("Unauthorized");
    });

    it("handles validation error with invalid link data", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Invalid link data"));
      await expect(api.linkRecords("t1", "f1", "r1", "invalid")).rejects.toThrow("Invalid link data");
    });

    it("handles conflict error when linking already linked records", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Records already linked"));
      await expect(api.linkRecords("t1", "f1", "r1", [{ Id: 1 }])).rejects.toThrow("Records already linked");
    });

    it("handles error when unlinking non-existent link", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Link not found"));
      await expect(api.unlinkRecords("t1", "f1", "r1", [{ Id: 999 }])).rejects.toThrow("Link not found");
    });

    it("handles network timeout in listLinks", async () => {
      vi.spyOn(client, "request").mockRejectedValue(new Error("Request timeout"));
      await expect(api.listLinks("t1", "f1", "r1")).rejects.toThrow("Request timeout");
    });
  });

  describe("Query parameter handling", () => {
    it("passes query parameters correctly to listLinks", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ list: [], pageInfo: {} });
      
      await api.listLinks("t1", "f1", "r1", {
        limit: 50,
        offset: 10,
        where: "(name,eq,test)",
      });
      
      expect(spy).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/t1/links/f1/records/r1",
        {
          query: {
            limit: 50,
            offset: 10,
            where: "(name,eq,test)",
          },
        }
      );
    });

    it("handles listLinks without query parameters", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ list: [], pageInfo: {} });
      
      await api.listLinks("t1", "f1", "r1");
      
      expect(spy).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/t1/links/f1/records/r1",
        { query: undefined }
      );
    });
  });

  describe("Link/unlink body handling", () => {
    it("handles linkRecords with array of IDs", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
      const body = [{ Id: 1 }, { Id: 2 }, { Id: 3 }];
      
      await api.linkRecords("t1", "f1", "r1", body);
      
      expect(spy).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/t1/links/f1/records/r1",
        { body }
      );
    });

    it("handles linkRecords with single ID", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
      const body = { Id: 1 };
      
      await api.linkRecords("t1", "f1", "r1", body);
      
      expect(spy).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/t1/links/f1/records/r1",
        { body }
      );
    });

    it("handles unlinkRecords with array of IDs", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
      const body = [{ Id: 1 }, { Id: 2 }];
      
      await api.unlinkRecords("t1", "f1", "r1", body);
      
      expect(spy).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/t1/links/f1/records/r1",
        { body }
      );
    });

    it("handles unlinkRecords with empty array", async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({ ok: true });
      const body: unknown[] = [];
      
      await api.unlinkRecords("t1", "f1", "r1", body);
      
      expect(spy).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/t1/links/f1/records/r1",
        { body }
      );
    });
  });
});
