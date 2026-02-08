import { describe, expect, it, vi, beforeEach } from "vitest";
import { NocoClient, MetaApi } from "../src/index.js";

describe("MetaApi", () => {
  let client: NocoClient;
  let api: MetaApi;

  beforeEach(() => {
    client = new NocoClient({ baseUrl: "http://test" });
    api = new MetaApi(client);
  });

  const testEndpoint = (name: string, method: string, path: string, fn: () => Promise<any>, body?: any) => {
    it(`${name} calls correct endpoint`, async () => {
      const spy = vi.spyOn(client, "request").mockResolvedValue({});
      await fn();
      if (body) {
        expect(spy).toHaveBeenCalledWith(method, path, { body });
      } else {
        expect(spy).toHaveBeenCalledWith(method, path);
      }
    });
  };

  describe("Bases", () => {
    testEndpoint("listBases", "GET", "/api/v2/meta/bases", () => api.listBases());
    testEndpoint("createBase", "POST", "/api/v2/meta/bases", () => api.createBase({ name: "b" }), { name: "b" });
    testEndpoint("getBase", "GET", "/api/v2/meta/bases/b1", () => api.getBase("b1"));
    testEndpoint("getBaseInfo", "GET", "/api/v2/meta/bases/b1/info", () => api.getBaseInfo("b1"));
    testEndpoint("updateBase", "PATCH", "/api/v2/meta/bases/b1", () => api.updateBase("b1", { title: "t" }), { title: "t" });
    testEndpoint("deleteBase", "DELETE", "/api/v2/meta/bases/b1", () => api.deleteBase("b1"));
    testEndpoint("getBaseSwagger", "GET", "/api/v2/meta/bases/b1/swagger.json", () => api.getBaseSwagger("b1"));
  });

  describe("Tables", () => {
    testEndpoint("listTables", "GET", "/api/v2/meta/bases/b1/tables", () => api.listTables("b1"));
    testEndpoint("createTable", "POST", "/api/v2/meta/bases/b1/tables", () => api.createTable("b1", { name: "t" }), { name: "t" });
    testEndpoint("getTable", "GET", "/api/v2/meta/tables/t1", () => api.getTable("t1"));
    testEndpoint("updateTable", "PATCH", "/api/v2/meta/tables/t1", () => api.updateTable("t1", { title: "t" }), { title: "t" });
    testEndpoint("deleteTable", "DELETE", "/api/v2/meta/tables/t1", () => api.deleteTable("t1"));
  });

  describe("Views", () => {
    testEndpoint("listViews", "GET", "/api/v2/meta/tables/t1/views", () => api.listViews("t1"));
    testEndpoint("createView", "POST", "/api/v2/meta/tables/t1/views", () => api.createView("t1", { name: "v" }), { name: "v" });
    testEndpoint("getView", "GET", "/api/v2/meta/views/v1", () => api.getView("v1"));
    testEndpoint("updateView", "PATCH", "/api/v2/meta/views/v1", () => api.updateView("v1", { title: "t" }), { title: "t" });
    testEndpoint("deleteView", "DELETE", "/api/v2/meta/views/v1", () => api.deleteView("v1"));
  });

  describe("Filters", () => {
    testEndpoint("listViewFilters", "GET", "/api/v2/meta/views/v1/filters", () => api.listViewFilters("v1"));
    testEndpoint("createViewFilter", "POST", "/api/v2/meta/views/v1/filters", () => api.createViewFilter("v1", { name: "f" }), { name: "f" });
    testEndpoint("getFilter", "GET", "/api/v2/meta/filters/f1", () => api.getFilter("f1"));
    testEndpoint("updateFilter", "PATCH", "/api/v2/meta/filters/f1", () => api.updateFilter("f1", { title: "t" }), { title: "t" });
    testEndpoint("deleteFilter", "DELETE", "/api/v2/meta/filters/f1", () => api.deleteFilter("f1"));
  });

  describe("Sorts", () => {
    testEndpoint("listViewSorts", "GET", "/api/v2/meta/views/v1/sorts", () => api.listViewSorts("v1"));
    testEndpoint("createViewSort", "POST", "/api/v2/meta/views/v1/sorts", () => api.createViewSort("v1", { name: "s" }), { name: "s" });
    testEndpoint("getSort", "GET", "/api/v2/meta/sorts/s1", () => api.getSort("s1"));
    testEndpoint("updateSort", "PATCH", "/api/v2/meta/sorts/s1", () => api.updateSort("s1", { title: "t" }), { title: "t" });
    testEndpoint("deleteSort", "DELETE", "/api/v2/meta/sorts/s1", () => api.deleteSort("s1"));
  });

  describe("Columns", () => {
    testEndpoint("listColumns", "GET", "/api/v2/meta/tables/t1/columns", () => api.listColumns("t1"));
    testEndpoint("createColumn", "POST", "/api/v2/meta/tables/t1/columns", () => api.createColumn("t1", { name: "c" }), { name: "c" });
    testEndpoint("getColumn", "GET", "/api/v2/meta/columns/c1", () => api.getColumn("c1"));
    testEndpoint("updateColumn", "PATCH", "/api/v2/meta/columns/c1", () => api.updateColumn("c1", { title: "t" }), { title: "t" });
    testEndpoint("deleteColumn", "DELETE", "/api/v2/meta/columns/c1", () => api.deleteColumn("c1"));
  });

  describe("Sources", () => {
    testEndpoint("listSources", "GET", "/api/v2/meta/bases/b1/sources", () => api.listSources("b1"));
    testEndpoint("createSource", "POST", "/api/v2/meta/bases/b1/sources", () => api.createSource("b1", { alias: "s" }), { alias: "s" });
    testEndpoint("getSource", "GET", "/api/v2/meta/bases/b1/sources/s1", () => api.getSource("b1", "s1"));
    testEndpoint("updateSource", "PATCH", "/api/v2/meta/bases/b1/sources/s1", () => api.updateSource("b1", "s1", { alias: "u" }), { alias: "u" });
    testEndpoint("deleteSource", "DELETE", "/api/v2/meta/bases/b1/sources/s1", () => api.deleteSource("b1", "s1"));
  });

  describe("Tokens (v2 base-scoped)", () => {
    testEndpoint("listTokens", "GET", "/api/v2/meta/bases/b1/api-tokens", () => api.listTokens("b1"));
    testEndpoint("createToken", "POST", "/api/v2/meta/bases/b1/api-tokens", () => api.createToken("b1", { description: "t" }), { description: "t" });
    testEndpoint("deleteToken", "DELETE", "/api/v2/meta/bases/b1/api-tokens/tok1", () => api.deleteToken("b1", "tok1"));
  });
});
