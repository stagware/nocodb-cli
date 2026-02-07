/**
 * Unit tests for LinkService
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkService } from "../src/services/link-service.js";
import type { NocoClient, ListResponse, Row } from "@nocodb/sdk";

describe("LinkService", () => {
  let mockClient: NocoClient;
  let linkService: LinkService;

  beforeEach(() => {
    // Create a mock NocoClient
    mockClient = {
      request: vi.fn(),
    } as unknown as NocoClient;

    linkService = new LinkService(mockClient);
  });

  describe("list", () => {
    it("should list linked records without query parameters", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [
          { Id: "rec1", title: "Linked Record 1" },
          { Id: "rec2", title: "Linked Record 2" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await linkService.list("tbl123", "col456", "rec789");

      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { query: undefined }
      );
      expect(result).toEqual(mockResponse);
      expect(result.list).toHaveLength(2);
    });

    it("should list linked records with query parameters", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [{ Id: "rec1", title: "Active Record" }],
        pageInfo: {
          totalRows: 1,
          page: 1,
          pageSize: 10,
          isFirstPage: true,
          isLastPage: true,
        },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const query = {
        limit: "10",
        offset: "0",
        where: "(Status,eq,Active)",
      };

      const result = await linkService.list("tbl123", "col456", "rec789", query);

      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { query }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle empty linked records list", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [],
        pageInfo: {
          totalRows: 0,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true,
        },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await linkService.list("tbl123", "col456", "rec789");

      expect(result.list).toHaveLength(0);
      expect(result.pageInfo.totalRows).toBe(0);
    });

    it("should handle pagination in query parameters", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [
          { Id: "rec26", title: "Record 26" },
          { Id: "rec27", title: "Record 27" },
        ],
        pageInfo: {
          totalRows: 100,
          page: 2,
          pageSize: 25,
          isFirstPage: false,
          isLastPage: false,
        },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await linkService.list("tbl123", "col456", "rec789", {
        limit: "25",
        offset: "25",
      });

      expect(result.pageInfo.page).toBe(2);
      expect(result.pageInfo.isFirstPage).toBe(false);
      expect(result.pageInfo.isLastPage).toBe(false);
    });
  });

  describe("link", () => {
    it("should link a single record", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body = [{ Id: "rec999" }];
      const result = await linkService.link("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should link multiple records", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body = [{ Id: "rec999" }, { Id: "rec888" }, { Id: "rec777" }];
      const result = await linkService.link("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle link operation with empty array", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body: unknown[] = [];
      const result = await linkService.link("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from client", async () => {
      const error = new Error("Network error");
      vi.mocked(mockClient.request).mockRejectedValue(error);

      const body = [{ Id: "rec999" }];

      await expect(
        linkService.link("tbl123", "col456", "rec789", body)
      ).rejects.toThrow("Network error");
    });
  });

  describe("unlink", () => {
    it("should unlink a single record", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body = [{ Id: "rec999" }];
      const result = await linkService.unlink("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should unlink multiple records", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body = [{ Id: "rec999" }, { Id: "rec888" }, { Id: "rec777" }];
      const result = await linkService.unlink("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle unlink operation with empty array", async () => {
      const mockResponse = { success: true };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const body: unknown[] = [];
      const result = await linkService.unlink("tbl123", "col456", "rec789", body);

      expect(mockClient.request).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/tbl123/links/col456/records/rec789",
        { body }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should propagate errors from client", async () => {
      const error = new Error("Not found");
      vi.mocked(mockClient.request).mockRejectedValue(error);

      const body = [{ Id: "rec999" }];

      await expect(
        linkService.unlink("tbl123", "col456", "rec789", body)
      ).rejects.toThrow("Not found");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete link workflow: list, link, list again", async () => {
      // Initial list - no links
      const emptyResponse: ListResponse<Row> = {
        list: [],
        pageInfo: { totalRows: 0, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
      };
      vi.mocked(mockClient.request).mockResolvedValueOnce(emptyResponse);

      const initialLinks = await linkService.list("tbl123", "col456", "rec789");
      expect(initialLinks.list).toHaveLength(0);

      // Link a record
      vi.mocked(mockClient.request).mockResolvedValueOnce({ success: true });
      await linkService.link("tbl123", "col456", "rec789", [{ Id: "rec999" }]);

      // List again - now has link
      const updatedResponse: ListResponse<Row> = {
        list: [{ Id: "rec999", title: "Linked Record" }],
        pageInfo: { totalRows: 1, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
      };
      vi.mocked(mockClient.request).mockResolvedValueOnce(updatedResponse);

      const updatedLinks = await linkService.list("tbl123", "col456", "rec789");
      expect(updatedLinks.list).toHaveLength(1);
      expect(updatedLinks.list[0].Id).toBe("rec999");
    });

    it("should handle complete unlink workflow: list, unlink, list again", async () => {
      // Initial list - has links
      const initialResponse: ListResponse<Row> = {
        list: [{ Id: "rec999", title: "Linked Record" }],
        pageInfo: { totalRows: 1, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
      };
      vi.mocked(mockClient.request).mockResolvedValueOnce(initialResponse);

      const initialLinks = await linkService.list("tbl123", "col456", "rec789");
      expect(initialLinks.list).toHaveLength(1);

      // Unlink the record
      vi.mocked(mockClient.request).mockResolvedValueOnce({ success: true });
      await linkService.unlink("tbl123", "col456", "rec789", [{ Id: "rec999" }]);

      // List again - now empty
      const emptyResponse: ListResponse<Row> = {
        list: [],
        pageInfo: { totalRows: 0, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
      };
      vi.mocked(mockClient.request).mockResolvedValueOnce(emptyResponse);

      const updatedLinks = await linkService.list("tbl123", "col456", "rec789");
      expect(updatedLinks.list).toHaveLength(0);
    });
  });
});
