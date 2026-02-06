import { describe, expect, it, vi } from "vitest";
import { NocoClient, MetaApi } from "../src/index.js";

describe("MetaApi", () => {
  const client = new NocoClient({ baseUrl: "http://test" });
  const api = new MetaApi(client);

  it("listBases calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue([]);
    await api.listBases();
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/bases");
  });

  it("createBase calls correct endpoint with body", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({});
    const body = { name: "New Base" };
    await api.createBase(body);
    expect(spy).toHaveBeenCalledWith("POST", "/api/v2/meta/bases", { body });
  });

  it("getBase calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({});
    await api.getBase("b1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/bases/b1");
  });

  it("deleteBase calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({});
    await api.deleteBase("b1");
    expect(spy).toHaveBeenCalledWith("DELETE", "/api/v2/meta/bases/b1");
  });

  it("listTables calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue([]);
    await api.listTables("b1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/bases/b1/tables");
  });

  it("getTable calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({});
    await api.getTable("t1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/tables/t1");
  });

  it("listViews calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue([]);
    await api.listViews("t1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/tables/t1/views");
  });

  it("listColumns calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue([]);
    await api.listColumns("t1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/tables/t1/columns");
  });

  it("getBaseSwagger calls correct endpoint", async () => {
    const spy = vi.spyOn(client, "request").mockResolvedValue({});
    await api.getBaseSwagger("b1");
    expect(spy).toHaveBeenCalledWith("GET", "/api/v2/meta/bases/b1/swagger.json");
  });
});
