/**
 * Unit tests for RowService
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RowService } from "../src/services/row-service.js";
import { ValidationError, NotFoundError, ConflictError } from "@nocodb/sdk";
import type { NocoClient, Row, ListResponse } from "@nocodb/sdk";
import type { SwaggerService } from "../src/services/swagger-service.js";
import type { SwaggerDoc } from "../src/utils/swagger.js";

describe("RowService", () => {
  let mockClient: NocoClient;
  let mockSwaggerService: SwaggerService;
  let rowService: RowService;

  const mockSwagger: SwaggerDoc = {
    paths: {
      "/api/v2/tables/tbl123/records": {
        get: { operationId: "list-rows" },
        post: {
          operationId: "create-row",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                    {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          status: { type: "string" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        patch: {
          operationId: "update-row",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        Id: { type: ["string", "number"] },
                        title: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                    {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          Id: { type: ["string", "number"] },
                          title: { type: "string" },
                          status: { type: "string" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        delete: {
          operationId: "delete-row",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        Id: { type: ["string", "number"] },
                      },
                    },
                    {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          Id: { type: ["string", "number"] },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  };

  beforeEach(() => {
    // Create mock client
    mockClient = {
      request: vi.fn(),
    } as unknown as NocoClient;

    // Create mock swagger service
    mockSwaggerService = {
      getSwagger: vi.fn().mockResolvedValue(mockSwagger),
    } as unknown as SwaggerService;

    // Create row service
    rowService = new RowService(mockClient, mockSwaggerService);
  });

  describe("list", () => {
    it("should list rows from a table", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [
          { Id: "rec1", title: "Row 1" },
          { Id: "rec2", title: "Row 2" },
        ],
        pageInfo: {
          totalRows: 2,
          page: 1,
          pageSize: 25,
        },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await rowService.list("tbl123");

      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/records",
        { query: undefined }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should list rows with query parameters", async () => {
      const mockResponse: ListResponse<Row> = {
        list: [{ Id: "rec1", title: "Row 1" }],
        pageInfo: { totalRows: 1 },
      };

      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await rowService.list("tbl123", { limit: "10", offset: "5" });

      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/records",
        { query: { limit: "10", offset: "5" } }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("create", () => {
    it("should create a row with validation", async () => {
      const newRow = { title: "New Row", status: "Active" };
      const createdRow = { Id: "rec123", ...newRow };

      vi.mocked(mockClient.request).mockResolvedValue(createdRow);

      const result = await rowService.create("tbl123", newRow, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/records",
        { body: newRow }
      );
      expect(result).toEqual(createdRow);
    });
  });

  describe("update", () => {
    it("should update a row with validation", async () => {
      const updateData = { Id: "rec123", title: "Updated Row" };
      const updatedRow = { ...updateData, status: "Active" };

      vi.mocked(mockClient.request).mockResolvedValue(updatedRow);

      const result = await rowService.update("tbl123", updateData, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(mockClient.request).toHaveBeenCalledWith(
        "PATCH",
        "/api/v2/tables/tbl123/records",
        { body: updateData }
      );
      expect(result).toEqual(updatedRow);
    });
  });

  describe("delete", () => {
    it("should delete a row", async () => {
      const deleteData = { Id: "rec123" };

      vi.mocked(mockClient.request).mockResolvedValue({ deleted: 1 });

      const result = await rowService.delete("tbl123", deleteData, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(mockClient.request).toHaveBeenCalledWith(
        "DELETE",
        "/api/v2/tables/tbl123/records",
        { body: deleteData }
      );
      expect(result).toEqual({ deleted: 1 });
    });
  });

  describe("bulkCreate", () => {
    it("should create multiple rows in fail-fast mode by default when no options provided", async () => {
      const rows = [
        { title: "Row 1", status: "Active" },
        { title: "Row 2", status: "Pending" },
      ];

      // Mock individual creates
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
        .mockResolvedValueOnce({ Id: "rec2", ...rows[1] });

      const result = await rowService.bulkCreate("tbl123", rows, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.data).toHaveLength(2);
    });

    it("should throw ValidationError if input is not an array", async () => {
      await expect(
        rowService.bulkCreate("tbl123", { title: "Not an array" } as any, "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should use fail-fast mode when failFast option is true", async () => {
      const rows = [
        { title: "Row 1", status: "Active" },
        { title: "Row 2", status: "Pending" },
      ];
      const response = { created: 2 };

      vi.mocked(mockClient.request).mockResolvedValue(response);

      const result = await rowService.bulkCreate("tbl123", rows, "base123", { failFast: true });

      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/records",
        { body: rows }
      );
      expect(result).toEqual(response);
    });

    it("should continue on error and track failures in continue-on-error mode", async () => {
      const rows = [
        { title: "Row 1", status: "Active" },
        { title: "Row 2", status: "Invalid" },
        { title: "Row 3", status: "Pending" },
      ];

      // Mock: first succeeds, second fails, third succeeds
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
        .mockRejectedValueOnce(new ValidationError("Invalid status"))
        .mockResolvedValueOnce({ Id: "rec3", ...rows[2] });

      const result = await rowService.bulkCreate("tbl123", rows, "base123", { continueOnError: true });

      expect(result.created).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        index: 1,
        item: rows[1],
        error: "Invalid status",
        code: "VALIDATION_ERROR",
      });
      expect(result.data).toHaveLength(2);
    });

    it("should track all failures when all items fail in continue-on-error mode", async () => {
      const rows = [
        { title: "Row 1", status: "Invalid1" },
        { title: "Row 2", status: "Invalid2" },
      ];

      vi.mocked(mockClient.request)
        .mockRejectedValueOnce(new ValidationError("Error 1"))
        .mockRejectedValueOnce(new ValidationError("Error 2"));

      const result = await rowService.bulkCreate("tbl123", rows, "base123");

      expect(result.created).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors![0].index).toBe(0);
      expect(result.errors![1].index).toBe(1);
    });

    it("should not include errors array when all items succeed", async () => {
      const rows = [
        { title: "Row 1", status: "Active" },
        { title: "Row 2", status: "Pending" },
      ];

      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
        .mockResolvedValueOnce({ Id: "rec2", ...rows[1] });

      const result = await rowService.bulkCreate("tbl123", rows, "base123");

      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("bulkUpdate", () => {
    it("should update multiple rows in continue-on-error mode by default", async () => {
      const rows = [
        { Id: "rec1", status: "Completed" },
        { Id: "rec2", status: "Completed" },
      ];

      // Mock individual updates
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
        .mockResolvedValueOnce({ Id: "rec2", status: "Completed" });

      const result = await rowService.bulkUpdate("tbl123", rows, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.data).toHaveLength(2);
    });

    it("should throw ValidationError if input is not an array", async () => {
      await expect(
        rowService.bulkUpdate("tbl123", { Id: "rec1" } as any, "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should use fail-fast mode when failFast option is true", async () => {
      const rows = [
        { Id: "rec1", status: "Completed" },
        { Id: "rec2", status: "Completed" },
      ];
      const response = { updated: 2 };

      vi.mocked(mockClient.request).mockResolvedValue(response);

      const result = await rowService.bulkUpdate("tbl123", rows, "base123", { failFast: true });

      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual(response);
    });

    it("should continue on error and track failures in continue-on-error mode", async () => {
      const rows = [
        { Id: "rec1", status: "Completed" },
        { Id: "rec2", status: "Invalid" },
        { Id: "rec3", status: "Completed" },
      ];

      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
        .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
        .mockResolvedValueOnce({ Id: "rec3", status: "Completed" });

      const result = await rowService.bulkUpdate("tbl123", rows, "base123");

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        index: 1,
        item: rows[1],
        code: "NOT_FOUND",
      });
    });

    it("should track all failures when all items fail", async () => {
      const rows = [
        { Id: "rec1", status: "Invalid1" },
        { Id: "rec2", status: "Invalid2" },
      ];

      vi.mocked(mockClient.request)
        .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
        .mockRejectedValueOnce(new NotFoundError("Row", "rec2"));

      const result = await rowService.bulkUpdate("tbl123", rows, "base123");

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("bulkDelete", () => {
    it("should delete multiple rows in continue-on-error mode by default", async () => {
      const rows = [{ Id: "rec1" }, { Id: "rec2" }];

      // Mock individual deletes
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ deleted: 1 })
        .mockResolvedValueOnce({ deleted: 1 });

      const result = await rowService.bulkDelete("tbl123", rows, "base123");

      expect(mockSwaggerService.getSwagger).toHaveBeenCalledWith("base123");
      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("should throw ValidationError if input is not an array", async () => {
      await expect(
        rowService.bulkDelete("tbl123", { Id: "rec1" } as any, "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should use fail-fast mode when failFast option is true", async () => {
      const rows = [{ Id: "rec1" }, { Id: "rec2" }];
      const response = { deleted: 2 };

      vi.mocked(mockClient.request).mockResolvedValue(response);

      const result = await rowService.bulkDelete("tbl123", rows, "base123", { failFast: true });

      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual(response);
    });

    it("should continue on error and track failures in continue-on-error mode", async () => {
      const rows = [{ Id: "rec1" }, { Id: "rec2" }, { Id: "rec3" }];

      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ deleted: 1 })
        .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
        .mockResolvedValueOnce({ deleted: 1 });

      const result = await rowService.bulkDelete("tbl123", rows, "base123");

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        index: 1,
        item: rows[1],
        code: "NOT_FOUND",
      });
    });

    it("should track all failures when all items fail", async () => {
      const rows = [{ Id: "rec1" }, { Id: "rec2" }];

      vi.mocked(mockClient.request)
        .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
        .mockRejectedValueOnce(new NotFoundError("Row", "rec2"));

      const result = await rowService.bulkDelete("tbl123", rows, "base123");

      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it("should not include errors array when all items succeed", async () => {
      const rows = [{ Id: "rec1" }, { Id: "rec2" }];

      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({ deleted: 1 })
        .mockResolvedValueOnce({ deleted: 1 });

      const result = await rowService.bulkDelete("tbl123", rows, "base123");

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("should create a new row when no match is found", async () => {
      const newRow = { email: "new@example.com", name: "New User" };
      const createdRow = { Id: "rec123", ...newRow };

      // Mock list to return no matches
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: [],
          pageInfo: { totalRows: 0 },
        })
        .mockResolvedValueOnce(createdRow);

      const result = await rowService.upsert(
        "tbl123",
        newRow,
        "email",
        "new@example.com",
        "base123"
      );

      expect(result).toEqual(createdRow);
      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/records",
        { body: newRow }
      );
    });

    it("should update an existing row when a match is found", async () => {
      const updateData = { email: "existing@example.com", name: "Updated Name" };
      const existingRow = { Id: "rec123", email: "existing@example.com", name: "Old Name" };
      const updatedRow = { Id: "rec123", ...updateData };

      // Mock list to return a match
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: [existingRow],
          pageInfo: { totalRows: 1 },
        })
        .mockResolvedValueOnce(updatedRow);

      const result = await rowService.upsert(
        "tbl123",
        updateData,
        "email",
        "existing@example.com",
        "base123"
      );

      expect(result).toEqual(updatedRow);
      expect(mockClient.request).toHaveBeenCalledWith(
        "PATCH",
        "/api/v2/tables/tbl123/records",
        { body: { ...updateData, Id: "rec123" } }
      );
    });

    it("should throw ValidationError when multiple matches are found", async () => {
      const updateData = { email: "duplicate@example.com", name: "Name" };

      // Mock list to return multiple matches
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: [
          { Id: "rec1", email: "duplicate@example.com" },
          { Id: "rec2", email: "duplicate@example.com" },
        ],
        pageInfo: { totalRows: 2 },
      });

      await expect(
        rowService.upsert("tbl123", updateData, "email", "duplicate@example.com", "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when updateOnly is true and no match is found", async () => {
      const updateData = { email: "missing@example.com", name: "Name" };

      // Mock list to return no matches
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: [],
        pageInfo: { totalRows: 0 },
      });

      await expect(
        rowService.upsert("tbl123", updateData, "email", "missing@example.com", "base123", {
          updateOnly: true,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ConflictError when createOnly is true and a match exists", async () => {
      const newRow = { email: "existing@example.com", name: "Name" };
      const existingRow = { Id: "rec123", email: "existing@example.com" };

      // Mock list to return a match
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: [existingRow],
        pageInfo: { totalRows: 1 },
      });

      await expect(
        rowService.upsert("tbl123", newRow, "email", "existing@example.com", "base123", {
          createOnly: true,
        })
      ).rejects.toThrow(ConflictError);
    });

    it("should handle race condition by retrying update", async () => {
      const newRow = { email: "race@example.com", name: "Name" };
      const existingRow = { Id: "rec123", email: "race@example.com" };
      const updatedRow = { Id: "rec123", ...newRow };

      // Mock list to return no matches initially
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: [],
          pageInfo: { totalRows: 0 },
        })
        // Mock create to throw conflict error
        .mockRejectedValueOnce(new ConflictError("Duplicate entry"))
        // Mock retry list to return a match
        .mockResolvedValueOnce({
          list: [existingRow],
          pageInfo: { totalRows: 1 },
        })
        // Mock update to succeed
        .mockResolvedValueOnce(updatedRow);

      const result = await rowService.upsert(
        "tbl123",
        newRow,
        "email",
        "race@example.com",
        "base123"
      );

      expect(result).toEqual(updatedRow);
      expect(mockClient.request).toHaveBeenCalledWith(
        "PATCH",
        "/api/v2/tables/tbl123/records",
        { body: { ...newRow, Id: "rec123" } }
      );
    });

    it("should throw ValidationError when both createOnly and updateOnly are true", async () => {
      await expect(
        rowService.upsert("tbl123", {}, "email", "test@example.com", "base123", {
          createOnly: true,
          updateOnly: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError when data is not an object", async () => {
      await expect(
        rowService.upsert("tbl123", [] as any, "email", "test@example.com", "base123")
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("bulk operation error reporting", () => {
    /**
     * **Validates: Requirements 3.8, 9.2, 9.3**
     * 
     * These tests validate Property 8: Bulk operation error reporting
     * 
     * For any bulk operation that encounters partial failures, the result should include:
     * - Separate success and failure counts
     * - Details about which specific items failed and why
     */

    describe("bulkCreate error reporting", () => {
      it("should report success count, failure count, and error details for partial failures", async () => {
        const rows = [
          { title: "Valid 1", status: "Active" },
          { title: "Invalid", status: "BadStatus" },
          { title: "Valid 2", status: "Pending" },
          { title: "Invalid 2", status: "BadStatus2" },
        ];

        // Mock: 1st succeeds, 2nd fails, 3rd succeeds, 4th fails
        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new ValidationError("Invalid status value"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] })
          .mockRejectedValueOnce(new ValidationError("Invalid status value 2"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        // Verify success count
        expect(result.created).toBe(2);
        
        // Verify failure count
        expect(result.failed).toBe(2);
        
        // Verify error details are present
        expect(result.errors).toBeDefined();
        expect(result.errors).toHaveLength(2);
        
        // Verify first error details
        expect(result.errors![0]).toMatchObject({
          index: 1,
          item: rows[1],
          error: "Invalid status value",
          code: "VALIDATION_ERROR",
        });
        
        // Verify second error details
        expect(result.errors![1]).toMatchObject({
          index: 3,
          item: rows[3],
          error: "Invalid status value 2",
          code: "VALIDATION_ERROR",
        });
      });

      it("should report different error types with appropriate codes", async () => {
        const rows = [
          { title: "Row 1" },
          { title: "Row 2" },
          { title: "Row 3" },
        ];

        // Mock different error types
        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new ValidationError("Validation failed"))
          .mockRejectedValueOnce(new ConflictError("Duplicate entry"))
          .mockRejectedValueOnce(new NotFoundError("Table", "tbl123"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(0);
        expect(result.failed).toBe(3);
        expect(result.errors).toHaveLength(3);
        
        // Verify different error codes are captured
        expect(result.errors![0].code).toBe("VALIDATION_ERROR");
        expect(result.errors![1].code).toBe("CONFLICT");
        expect(result.errors![2].code).toBe("NOT_FOUND");
      });

      it("should include error messages that explain why each item failed", async () => {
        const rows = [
          { title: "Row 1", email: "invalid-email" },
          { title: "Row 2", age: -5 },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new ValidationError("Invalid email format"))
          .mockRejectedValueOnce(new ValidationError("Age must be positive"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.errors![0].error).toBe("Invalid email format");
        expect(result.errors![1].error).toBe("Age must be positive");
      });

      it("should include the original item data in error details", async () => {
        const rows = [
          { title: "Row 1", customField: "value1" },
          { title: "Row 2", customField: "value2" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new ValidationError("Error 1"))
          .mockRejectedValueOnce(new ValidationError("Error 2"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        // Verify the exact item that failed is included
        expect(result.errors![0].item).toEqual(rows[0]);
        expect(result.errors![1].item).toEqual(rows[1]);
      });
    });

    describe("bulkUpdate error reporting", () => {
      it("should report success count, failure count, and error details for partial failures", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Invalid" },
          { Id: "rec3", status: "Completed" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
          .mockResolvedValueOnce({ Id: "rec3", status: "Completed" });

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors![0]).toMatchObject({
          index: 1,
          item: rows[1],
          code: "NOT_FOUND",
        });
      });

      it("should handle authentication errors in bulk updates", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Completed" },
        ];

        const authError = new Error("Unauthorized");
        (authError as any).statusCode = 401;

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockRejectedValueOnce(authError);

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors![0].error).toBe("Unauthorized");
      });
    });

    describe("bulkDelete error reporting", () => {
      it("should report success count, failure count, and error details for partial failures", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
          { Id: "rec3" },
          { Id: "rec4" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec4"));

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(2);
        expect(result.failed).toBe(2);
        expect(result.errors).toHaveLength(2);
        
        expect(result.errors![0]).toMatchObject({
          index: 1,
          item: rows[1],
          code: "NOT_FOUND",
        });
        
        expect(result.errors![1]).toMatchObject({
          index: 3,
          item: rows[3],
          code: "NOT_FOUND",
        });
      });

      it("should handle permission errors in bulk deletes", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
        ];

        const permissionError = new Error("Forbidden");
        (permissionError as any).statusCode = 403;

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(permissionError);

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors![0].error).toBe("Forbidden");
      });
    });

    describe("error reporting with all failures", () => {
      it("should report all failures when no items succeed in bulkCreate", async () => {
        const rows = [
          { title: "Row 1" },
          { title: "Row 2" },
          { title: "Row 3" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new ValidationError("Error 1"))
          .mockRejectedValueOnce(new ValidationError("Error 2"))
          .mockRejectedValueOnce(new ValidationError("Error 3"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(0);
        expect(result.failed).toBe(3);
        expect(result.errors).toHaveLength(3);
        
        // Verify all errors are tracked with correct indices
        expect(result.errors![0].index).toBe(0);
        expect(result.errors![1].index).toBe(1);
        expect(result.errors![2].index).toBe(2);
      });

      it("should report all failures when no items succeed in bulkUpdate", async () => {
        const rows = [
          { Id: "rec1", status: "Invalid" },
          { Id: "rec2", status: "Invalid" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"));

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(0);
        expect(result.failed).toBe(2);
        expect(result.errors).toHaveLength(2);
      });

      it("should report all failures when no items succeed in bulkDelete", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"));

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(0);
        expect(result.failed).toBe(2);
        expect(result.errors).toHaveLength(2);
      });
    });

    describe("error reporting with all successes", () => {
      it("should not include errors array when all items succeed in bulkCreate", async () => {
        const rows = [
          { title: "Row 1" },
          { title: "Row 2" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockResolvedValueOnce({ Id: "rec2", ...rows[1] });

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toBeUndefined();
      });

      it("should not include errors array when all items succeed in bulkUpdate", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Completed" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockResolvedValueOnce({ Id: "rec2", status: "Completed" });

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toBeUndefined();
      });

      it("should not include errors array when all items succeed in bulkDelete", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockResolvedValueOnce({ deleted: 1 });

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toBeUndefined();
      });
    });

    describe("error reporting with non-NocoDBError exceptions", () => {
      it("should handle generic errors without error codes", async () => {
        const rows = [
          { title: "Row 1" },
          { title: "Row 2" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new Error("Network timeout"))
          .mockRejectedValueOnce(new Error("Connection refused"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(0);
        expect(result.failed).toBe(2);
        expect(result.errors![0].error).toBe("Network timeout");
        expect(result.errors![0].code).toBeUndefined();
        expect(result.errors![1].error).toBe("Connection refused");
        expect(result.errors![1].code).toBeUndefined();
      });

      it("should handle non-Error exceptions", async () => {
        const rows = [{ title: "Row 1" }];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce("String error");

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(0);
        expect(result.failed).toBe(1);
        expect(result.errors![0].error).toBe("String error");
      });
    });
  });

  describe("bulk operation continuation", () => {
    /**
     * **Validates: Requirements 9.1**
     * 
     * These tests validate Property 13: Bulk operation continuation
     * 
     * For any bulk operation with a mix of valid and invalid items, when --continue-on-error
     * is enabled (default), all valid items should be processed successfully regardless of
     * invalid item failures.
     */

    describe("bulkCreate continuation", () => {
      it("should process all valid items when some items fail (default continue-on-error)", async () => {
        const rows = [
          { title: "Valid 1", status: "Active" },
          { title: "Invalid 1", status: "BadStatus" },
          { title: "Valid 2", status: "Pending" },
          { title: "Invalid 2", status: "BadStatus2" },
          { title: "Valid 3", status: "Active" },
        ];

        // Mock: items at indices 0, 2, 4 succeed; items at indices 1, 3 fail
        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new ValidationError("Invalid status"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] })
          .mockRejectedValueOnce(new ValidationError("Invalid status"))
          .mockResolvedValueOnce({ Id: "rec5", ...rows[4] });

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        // All valid items should be processed
        expect(result.created).toBe(3);
        expect(result.data).toHaveLength(3);
        expect(result.data![0]).toMatchObject({ Id: "rec1" });
        expect(result.data![1]).toMatchObject({ Id: "rec3" });
        expect(result.data![2]).toMatchObject({ Id: "rec5" });

        // Failed items should be tracked
        expect(result.failed).toBe(2);
        expect(result.errors).toHaveLength(2);
      });

      it("should process all valid items when first item fails", async () => {
        const rows = [
          { title: "Invalid", status: "BadStatus" },
          { title: "Valid 1", status: "Active" },
          { title: "Valid 2", status: "Pending" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new ValidationError("Invalid status"))
          .mockResolvedValueOnce({ Id: "rec2", ...rows[1] })
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] });

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.data).toHaveLength(2);
      });

      it("should process all valid items when last item fails", async () => {
        const rows = [
          { title: "Valid 1", status: "Active" },
          { title: "Valid 2", status: "Pending" },
          { title: "Invalid", status: "BadStatus" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockResolvedValueOnce({ Id: "rec2", ...rows[1] })
          .mockRejectedValueOnce(new ValidationError("Invalid status"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.data).toHaveLength(2);
      });

      it("should process all valid items with various error types", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Conflict" },
          { title: "Valid 2" },
          { title: "NotFound" },
          { title: "Valid 3" },
          { title: "Auth" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new ConflictError("Duplicate"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] })
          .mockRejectedValueOnce(new NotFoundError("Table", "tbl123"))
          .mockResolvedValueOnce({ Id: "rec5", ...rows[4] })
          .mockRejectedValueOnce(new Error("Unauthorized"));

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        // All valid items processed despite different error types
        expect(result.created).toBe(3);
        expect(result.failed).toBe(3);
        expect(result.data).toHaveLength(3);
      });

      it("should continue processing even with network errors", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Network Error" },
          { title: "Valid 2" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new Error("Network timeout"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] });

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(1);
      });
    });

    describe("bulkUpdate continuation", () => {
      it("should process all valid items when some items fail (default continue-on-error)", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Invalid" },
          { Id: "rec3", status: "Completed" },
          { Id: "rec4", status: "Invalid" },
          { Id: "rec5", status: "Completed" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
          .mockResolvedValueOnce({ Id: "rec3", status: "Completed" })
          .mockRejectedValueOnce(new ValidationError("Invalid status"))
          .mockResolvedValueOnce({ Id: "rec5", status: "Completed" });

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(3);
        expect(result.failed).toBe(2);
        expect(result.data).toHaveLength(3);
      });

      it("should process all valid items when first item fails", async () => {
        const rows = [
          { Id: "rec1", status: "Invalid" },
          { Id: "rec2", status: "Completed" },
          { Id: "rec3", status: "Completed" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
          .mockResolvedValueOnce({ Id: "rec2", status: "Completed" })
          .mockResolvedValueOnce({ Id: "rec3", status: "Completed" });

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should process all valid items when last item fails", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Completed" },
          { Id: "rec3", status: "Invalid" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockResolvedValueOnce({ Id: "rec2", status: "Completed" })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec3"));

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should continue processing with permission errors", async () => {
        const rows = [
          { Id: "rec1", status: "Completed" },
          { Id: "rec2", status: "Completed" },
          { Id: "rec3", status: "Completed" },
        ];

        const permissionError = new Error("Forbidden");
        (permissionError as any).statusCode = 403;

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", status: "Completed" })
          .mockRejectedValueOnce(permissionError)
          .mockResolvedValueOnce({ Id: "rec3", status: "Completed" });

        const result = await rowService.bulkUpdate("tbl123", rows, "base123");

        expect(result.updated).toBe(2);
        expect(result.failed).toBe(1);
      });
    });

    describe("bulkDelete continuation", () => {
      it("should process all valid items when some items fail (default continue-on-error)", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
          { Id: "rec3" },
          { Id: "rec4" },
          { Id: "rec5" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec4"))
          .mockResolvedValueOnce({ deleted: 1 });

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(3);
        expect(result.failed).toBe(2);
      });

      it("should process all valid items when first item fails", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
          { Id: "rec3" },
        ];

        vi.mocked(mockClient.request)
          .mockRejectedValueOnce(new NotFoundError("Row", "rec1"))
          .mockResolvedValueOnce({ deleted: 1 })
          .mockResolvedValueOnce({ deleted: 1 });

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should process all valid items when last item fails", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
          { Id: "rec3" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec3"));

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should continue processing with various error types", async () => {
        const rows = [
          { Id: "rec1" },
          { Id: "rec2" },
          { Id: "rec3" },
          { Id: "rec4" },
        ];

        const authError = new Error("Unauthorized");
        (authError as any).statusCode = 401;

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(new NotFoundError("Row", "rec2"))
          .mockResolvedValueOnce({ deleted: 1 })
          .mockRejectedValueOnce(authError);

        const result = await rowService.bulkDelete("tbl123", rows, "base123");

        expect(result.deleted).toBe(2);
        expect(result.failed).toBe(2);
      });
    });

    describe("continuation with large datasets", () => {
      it("should process all valid items in a large batch with scattered failures", async () => {
        const rows = Array.from({ length: 20 }, (_, i) => ({
          title: `Row ${i + 1}`,
          status: i % 5 === 0 ? "Invalid" : "Active",
        }));

        // Mock: every 5th item fails (indices 0, 5, 10, 15)
        for (let i = 0; i < rows.length; i++) {
          if (i % 5 === 0) {
            vi.mocked(mockClient.request).mockRejectedValueOnce(
              new ValidationError("Invalid status")
            );
          } else {
            vi.mocked(mockClient.request).mockResolvedValueOnce({
              Id: `rec${i + 1}`,
              ...rows[i],
            });
          }
        }

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        // 16 valid items (20 - 4 failures)
        expect(result.created).toBe(16);
        expect(result.failed).toBe(4);
        expect(result.data).toHaveLength(16);
        expect(result.errors).toHaveLength(4);
      });

      it("should process all valid items when majority fail", async () => {
        const rows = Array.from({ length: 10 }, (_, i) => ({
          title: `Row ${i + 1}`,
        }));

        // Mock: only 2 items succeed (indices 3 and 7)
        for (let i = 0; i < rows.length; i++) {
          if (i === 3 || i === 7) {
            vi.mocked(mockClient.request).mockResolvedValueOnce({
              Id: `rec${i + 1}`,
              ...rows[i],
            });
          } else {
            vi.mocked(mockClient.request).mockRejectedValueOnce(
              new ValidationError("Validation failed")
            );
          }
        }

        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(8);
        expect(result.data).toHaveLength(2);
      });
    });

    describe("continuation vs fail-fast mode", () => {
      it("should continue processing by default (continueOnError not specified)", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Invalid" },
          { title: "Valid 2" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new ValidationError("Invalid"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] });

        // No options specified - should default to continue-on-error
        const result = await rowService.bulkCreate("tbl123", rows, "base123");

        expect(result.created).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should continue processing when continueOnError is explicitly true", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Invalid" },
          { title: "Valid 2" },
        ];

        vi.mocked(mockClient.request)
          .mockResolvedValueOnce({ Id: "rec1", ...rows[0] })
          .mockRejectedValueOnce(new ValidationError("Invalid"))
          .mockResolvedValueOnce({ Id: "rec3", ...rows[2] });

        const result = await rowService.bulkCreate("tbl123", rows, "base123", {
          continueOnError: true,
        });

        expect(result.created).toBe(2);
        expect(result.failed).toBe(1);
      });

      it("should stop on first error when failFast is true", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Invalid" },
          { title: "Valid 2" },
        ];

        vi.mocked(mockClient.request).mockResolvedValue({ created: 3 });

        const result = await rowService.bulkCreate("tbl123", rows, "base123", {
          failFast: true,
        });

        // In fail-fast mode, single request is made
        expect(mockClient.request).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ created: 3 });
      });

      it("should prioritize failFast over continueOnError when both are set", async () => {
        const rows = [
          { title: "Valid 1" },
          { title: "Valid 2" },
        ];

        vi.mocked(mockClient.request).mockResolvedValue({ created: 2 });

        const result = await rowService.bulkCreate("tbl123", rows, "base123", {
          failFast: true,
          continueOnError: true, // Should be ignored
        });

        // Should use fail-fast mode (single request)
        expect(mockClient.request).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("bulkUpsert", () => {
    it("should create and update rows based on match field", async () => {
      const rows = [
        { email: "new@example.com", name: "New User" },
        { email: "existing@example.com", name: "Updated User" },
      ];
      const existingRows = [{ Id: "rec123", email: "existing@example.com", name: "Old Name" }];

      // Mock list to return existing rows
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: existingRows,
          pageInfo: { totalRows: 1 },
        })
        // Mock bulk create
        .mockResolvedValueOnce({ created: 1 })
        // Mock bulk update
        .mockResolvedValueOnce({ updated: 1 });

      const result = await rowService.bulkUpsert("tbl123", rows, "email", "base123");

      expect(result.created).toEqual({ created: 1 });
      expect(result.updated).toEqual({ updated: 1 });
      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/tables/tbl123/records",
        { body: [{ email: "new@example.com", name: "New User" }] }
      );
      expect(mockClient.request).toHaveBeenCalledWith(
        "PATCH",
        "/api/v2/tables/tbl123/records",
        { body: [{ email: "existing@example.com", name: "Updated User", Id: "rec123" }] }
      );
    });

    it("should only create when all rows are new", async () => {
      const rows = [
        { email: "new1@example.com", name: "User 1" },
        { email: "new2@example.com", name: "User 2" },
      ];

      // Mock list to return no existing rows
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: [],
          pageInfo: { totalRows: 0 },
        })
        // Mock bulk create
        .mockResolvedValueOnce({ created: 2 });

      const result = await rowService.bulkUpsert("tbl123", rows, "email", "base123");

      expect(result.created).toEqual({ created: 2 });
      expect(result.updated).toBeUndefined();
    });

    it("should only update when all rows exist", async () => {
      const rows = [
        { email: "existing1@example.com", name: "Updated 1" },
        { email: "existing2@example.com", name: "Updated 2" },
      ];
      const existingRows = [
        { Id: "rec1", email: "existing1@example.com" },
        { Id: "rec2", email: "existing2@example.com" },
      ];

      // Mock list to return existing rows
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce({
          list: existingRows,
          pageInfo: { totalRows: 2 },
        })
        // Mock bulk update
        .mockResolvedValueOnce({ updated: 2 });

      const result = await rowService.bulkUpsert("tbl123", rows, "email", "base123");

      expect(result.created).toBeUndefined();
      expect(result.updated).toEqual({ updated: 2 });
    });

    it("should throw ValidationError when multiple rows match the same value", async () => {
      const rows = [{ email: "duplicate@example.com", name: "Name" }];
      const existingRows = [
        { Id: "rec1", email: "duplicate@example.com" },
        { Id: "rec2", email: "duplicate@example.com" },
      ];

      // Mock list to return duplicate matches
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: existingRows,
        pageInfo: { totalRows: 2 },
      });

      await expect(
        rowService.bulkUpsert("tbl123", rows, "email", "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError when updateOnly is true and a row is missing match field", async () => {
      const rows = [{ name: "No Email" }];

      // Mock list to return empty (not needed but called before validation)
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: [],
        pageInfo: { totalRows: 0 },
      });

      await expect(
        rowService.bulkUpsert("tbl123", rows, "email", "base123", { updateOnly: true })
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when updateOnly is true and no match is found", async () => {
      const rows = [{ email: "missing@example.com", name: "Name" }];

      // Mock list to return no existing rows
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: [],
        pageInfo: { totalRows: 0 },
      });

      await expect(
        rowService.bulkUpsert("tbl123", rows, "email", "base123", { updateOnly: true })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ConflictError when createOnly is true and a match exists", async () => {
      const rows = [{ email: "existing@example.com", name: "Name" }];
      const existingRows = [{ Id: "rec123", email: "existing@example.com" }];

      // Mock list to return existing row
      vi.mocked(mockClient.request).mockResolvedValueOnce({
        list: existingRows,
        pageInfo: { totalRows: 1 },
      });

      await expect(
        rowService.bulkUpsert("tbl123", rows, "email", "base123", { createOnly: true })
      ).rejects.toThrow(ConflictError);
    });

    it("should throw ValidationError when input is not an array", async () => {
      await expect(
        rowService.bulkUpsert("tbl123", { email: "test@example.com" } as any, "email", "base123")
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError when both createOnly and updateOnly are true", async () => {
      await expect(
        rowService.bulkUpsert("tbl123", [], "email", "base123", {
          createOnly: true,
          updateOnly: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should handle pagination when fetching existing rows", async () => {
      const rows = [{ email: "test@example.com", name: "Test" }];

      // Mock paginated list responses
      vi.mocked(mockClient.request)
        // First page
        .mockResolvedValueOnce({
          list: Array(1000).fill({ Id: "rec1", email: "other@example.com" }),
          pageInfo: { totalRows: 1500, page: 1, pageSize: 1000 },
        })
        // Second page
        .mockResolvedValueOnce({
          list: Array(500).fill({ Id: "rec2", email: "other@example.com" }),
          pageInfo: { totalRows: 1500, page: 2, pageSize: 1000 },
        })
        // Mock bulk create
        .mockResolvedValueOnce({ created: 1 });

      const result = await rowService.bulkUpsert("tbl123", rows, "email", "base123");

      expect(result.created).toEqual({ created: 1 });
      // Verify pagination calls
      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/records",
        { query: { page: "1", limit: "1000" } }
      );
      expect(mockClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v2/tables/tbl123/records",
        { query: { page: "2", limit: "1000" } }
      );
    });
  });
});
