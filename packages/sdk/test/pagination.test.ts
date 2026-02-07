import { describe, expect, it, vi, beforeEach } from "vitest";
import { NocoClient } from "../src/index.js";

describe("NocoClient.fetchAllPages", () => {
  let client: NocoClient;

  beforeEach(() => {
    client = new NocoClient({ baseUrl: "http://test" });
  });

  it("returns single page when all data fits", async () => {
    vi.spyOn(client, "request").mockResolvedValueOnce({
      list: [{ Id: 1 }, { Id: 2 }],
      pageInfo: { totalRows: 2, page: 1, pageSize: 25 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records");

    expect(result.list).toHaveLength(2);
    expect(result.list[0].Id).toBe(1);
    expect(result.list[1].Id).toBe(2);
  });

  it("fetches multiple pages when totalRows exceeds pageSize", async () => {
    const spy = vi.spyOn(client, "request");

    // Page 1
    spy.mockResolvedValueOnce({
      list: [{ Id: 1 }, { Id: 2 }],
      pageInfo: { totalRows: 5, page: 1, pageSize: 2 },
    });
    // Page 2
    spy.mockResolvedValueOnce({
      list: [{ Id: 3 }, { Id: 4 }],
      pageInfo: { totalRows: 5, page: 2, pageSize: 2 },
    });
    // Page 3
    spy.mockResolvedValueOnce({
      list: [{ Id: 5 }],
      pageInfo: { totalRows: 5, page: 3, pageSize: 2 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records", {}, 2);

    expect(result.list).toHaveLength(5);
    expect(result.list.map((r: any) => r.Id)).toEqual([1, 2, 3, 4, 5]);
    expect(spy).toHaveBeenCalledTimes(3);

    // Verify offset-based pagination
    expect(spy).toHaveBeenNthCalledWith(1, "GET", "/api/v2/tables/t1/records", {
      query: { limit: 2, offset: 0 },
    });
    expect(spy).toHaveBeenNthCalledWith(2, "GET", "/api/v2/tables/t1/records", {
      query: { limit: 2, offset: 2 },
    });
    expect(spy).toHaveBeenNthCalledWith(3, "GET", "/api/v2/tables/t1/records", {
      query: { limit: 2, offset: 4 },
    });
  });

  it("returns empty list when no data", async () => {
    vi.spyOn(client, "request").mockResolvedValueOnce({
      list: [],
      pageInfo: { totalRows: 0 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records");

    expect(result.list).toHaveLength(0);
  });

  it("stops when server returns empty page (safety)", async () => {
    const spy = vi.spyOn(client, "request");

    spy.mockResolvedValueOnce({
      list: [{ Id: 1 }, { Id: 2 }],
      pageInfo: { totalRows: 100 },
    });
    spy.mockResolvedValueOnce({
      list: [],
      pageInfo: { totalRows: 100 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records", {}, 2);

    expect(result.list).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("preserves extra query parameters across pages", async () => {
    const spy = vi.spyOn(client, "request");

    spy.mockResolvedValueOnce({
      list: [{ Id: 1 }],
      pageInfo: { totalRows: 2 },
    });
    spy.mockResolvedValueOnce({
      list: [{ Id: 2 }],
      pageInfo: { totalRows: 2 },
    });

    await client.fetchAllPages(
      "GET",
      "/api/v2/tables/t1/records",
      { query: { where: "(Status,eq,Active)" } },
      1,
    );

    expect(spy).toHaveBeenNthCalledWith(1, "GET", "/api/v2/tables/t1/records", {
      query: { where: "(Status,eq,Active)", limit: 1, offset: 0 },
    });
    expect(spy).toHaveBeenNthCalledWith(2, "GET", "/api/v2/tables/t1/records", {
      query: { where: "(Status,eq,Active)", limit: 1, offset: 1 },
    });
  });

  it("returns combined pageInfo with isFirstPage and isLastPage true", async () => {
    const spy = vi.spyOn(client, "request");

    spy.mockResolvedValueOnce({
      list: [{ Id: 1 }],
      pageInfo: { totalRows: 2 },
    });
    spy.mockResolvedValueOnce({
      list: [{ Id: 2 }],
      pageInfo: { totalRows: 2 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records", {}, 1);

    expect(result.pageInfo).toEqual({
      totalRows: 2,
      page: 1,
      pageSize: 2,
      isFirstPage: true,
      isLastPage: true,
    });
  });

  it("short-circuits when first page has fewer items than pageSize", async () => {
    const spy = vi.spyOn(client, "request");

    spy.mockResolvedValueOnce({
      list: [{ Id: 1 }, { Id: 2 }, { Id: 3 }],
      pageInfo: { totalRows: 3, pageSize: 1000 },
    });

    const result = await client.fetchAllPages("GET", "/api/v2/tables/t1/records");

    expect(result.list).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from underlying request", async () => {
    vi.spyOn(client, "request").mockRejectedValueOnce(new Error("Network Error"));

    await expect(
      client.fetchAllPages("GET", "/api/v2/tables/t1/records"),
    ).rejects.toThrow("Network Error");
  });

  it("uses default pageSize of 1000", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValueOnce({
      list: [{ Id: 1 }],
      pageInfo: { totalRows: 1 },
    });

    await client.fetchAllPages("GET", "/api/v2/tables/t1/records");

    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/tables/t1/records", {
      query: { limit: 1000, offset: 0 },
    });
  });
});
