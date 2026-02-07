/**
 * Unit tests for StorageService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageService } from "../src/services/storage-service.js";
import type { NocoClient } from "@nocodb/sdk";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof fs>("node:fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
    },
  };
});

describe("StorageService", () => {
  let mockClient: NocoClient;
  let storageService: StorageService;

  beforeEach(() => {
    // Create a mock NocoClient
    mockClient = {
      request: vi.fn(),
    } as unknown as NocoClient;

    storageService = new StorageService(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("upload", () => {
    it("should upload a file successfully", async () => {
      const mockFileContent = Buffer.from("test file content");
      const mockResponse = {
        url: "https://example.com/uploads/test.txt",
        title: "test.txt",
        mimetype: "text/plain",
        size: 17,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await storageService.upload("./test.txt");

      // Verify file was read
      expect(fs.promises.readFile).toHaveBeenCalledWith("./test.txt");

      // Verify request was made with correct parameters
      expect(mockClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v2/storage/upload",
        expect.objectContaining({
          body: expect.any(Buffer),
          headers: expect.objectContaining({
            "content-type": expect.stringMatching(/^multipart\/form-data; boundary=----nocodb-\d+$/),
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should handle file with absolute path", async () => {
      const mockFileContent = Buffer.from("absolute path content");
      const mockResponse = {
        url: "https://example.com/uploads/document.pdf",
        title: "document.pdf",
        mimetype: "application/pdf",
        size: 21,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await storageService.upload("/home/user/documents/document.pdf");

      expect(fs.promises.readFile).toHaveBeenCalledWith("/home/user/documents/document.pdf");
      expect(result).toEqual(mockResponse);
    });

    it("should extract filename correctly from path", async () => {
      const mockFileContent = Buffer.from("nested file content");
      const mockResponse = {
        url: "https://example.com/uploads/photo.jpg",
        title: "photo.jpg",
        mimetype: "image/jpeg",
        size: 19,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      await storageService.upload("./path/to/nested/photo.jpg");

      // Verify the request body contains the correct filename
      const callArgs = vi.mocked(mockClient.request).mock.calls[0];
      const body = callArgs[2]?.body as Buffer;
      const bodyString = body.toString();

      expect(bodyString).toContain('filename="photo.jpg"');
    });

    it("should create proper multipart form data structure", async () => {
      const mockFileContent = Buffer.from("test content");
      const mockResponse = { url: "https://example.com/uploads/file.txt" };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      await storageService.upload("./file.txt");

      const callArgs = vi.mocked(mockClient.request).mock.calls[0];
      const body = callArgs[2]?.body as Buffer;
      const bodyString = body.toString();

      // Verify multipart structure
      // Note: boundary is ----nocodb-{timestamp}, but in body it's prefixed with -- making it ------nocodb-
      expect(bodyString).toMatch(/^------nocodb-\d+\r\n/);
      expect(bodyString).toContain('Content-Disposition: form-data; name="file"; filename="file.txt"');
      expect(bodyString).toContain("Content-Type: application/octet-stream");
      expect(bodyString).toContain("test content");
      expect(bodyString).toMatch(/\r\n------nocodb-\d+--\r\n$/);
    });

    it("should use unique boundary for each upload", async () => {
      const mockFileContent = Buffer.from("content");
      const mockResponse = { url: "https://example.com/uploads/file.txt" };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      // First upload
      await storageService.upload("./file1.txt");
      const firstCall = vi.mocked(mockClient.request).mock.calls[0];
      const firstBoundary = firstCall[2]?.headers?.["content-type"];

      // Second upload (simulate time passing)
      vi.clearAllMocks();
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);
      
      await storageService.upload("./file2.txt");
      const secondCall = vi.mocked(mockClient.request).mock.calls[0];
      const secondBoundary = secondCall[2]?.headers?.["content-type"];

      // Boundaries should contain timestamp and be different (or at least formatted correctly)
      expect(firstBoundary).toMatch(/^multipart\/form-data; boundary=----nocodb-\d+$/);
      expect(secondBoundary).toMatch(/^multipart\/form-data; boundary=----nocodb-\d+$/);
    });

    it("should handle binary file content", async () => {
      // Create a buffer with binary data
      const mockFileContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const mockResponse = {
        url: "https://example.com/uploads/image.png",
        title: "image.png",
        mimetype: "image/png",
        size: 8,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await storageService.upload("./image.png");

      expect(result).toEqual(mockResponse);

      // Verify binary content is preserved in the body
      const callArgs = vi.mocked(mockClient.request).mock.calls[0];
      const body = callArgs[2]?.body as Buffer;
      
      // The body should contain the binary data
      expect(body).toBeInstanceOf(Buffer);
      expect(body.includes(mockFileContent)).toBe(true);
    });

    it("should propagate file read errors", async () => {
      const error = new Error("ENOENT: no such file or directory");
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(storageService.upload("./nonexistent.txt")).rejects.toThrow(
        "ENOENT: no such file or directory"
      );

      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it("should propagate upload errors from client", async () => {
      const mockFileContent = Buffer.from("content");
      const error = new Error("Network error");

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockRejectedValue(error);

      await expect(storageService.upload("./file.txt")).rejects.toThrow("Network error");
    });

    it("should handle files with special characters in filename", async () => {
      const mockFileContent = Buffer.from("special content");
      const mockResponse = {
        url: "https://example.com/uploads/file%20with%20spaces.txt",
        title: "file with spaces.txt",
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      await storageService.upload("./path/to/file with spaces.txt");

      const callArgs = vi.mocked(mockClient.request).mock.calls[0];
      const body = callArgs[2]?.body as Buffer;
      const bodyString = body.toString();

      expect(bodyString).toContain('filename="file with spaces.txt"');
    });

    it("should handle empty file", async () => {
      const mockFileContent = Buffer.from("");
      const mockResponse = {
        url: "https://example.com/uploads/empty.txt",
        title: "empty.txt",
        size: 0,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await storageService.upload("./empty.txt");

      expect(result).toEqual(mockResponse);
      expect(fs.promises.readFile).toHaveBeenCalledWith("./empty.txt");
    });

    it("should handle large file content", async () => {
      // Create a large buffer (1MB)
      const mockFileContent = Buffer.alloc(1024 * 1024, "a");
      const mockResponse = {
        url: "https://example.com/uploads/large.bin",
        title: "large.bin",
        size: 1048576,
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await storageService.upload("./large.bin");

      expect(result).toEqual(mockResponse);

      // Verify the body contains the large file
      const callArgs = vi.mocked(mockClient.request).mock.calls[0];
      const body = callArgs[2]?.body as Buffer;
      
      // Body should be larger than the file content due to multipart headers
      expect(body.length).toBeGreaterThan(mockFileContent.length);
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple sequential uploads", async () => {
      const files = [
        { path: "./file1.txt", content: "content1" },
        { path: "./file2.txt", content: "content2" },
        { path: "./file3.txt", content: "content3" },
      ];

      for (const file of files) {
        vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from(file.content));
        vi.mocked(mockClient.request).mockResolvedValueOnce({
          url: `https://example.com/uploads/${path.basename(file.path)}`,
          title: path.basename(file.path),
        });

        const result = await storageService.upload(file.path);
        expect(result.title).toBe(path.basename(file.path));
      }

      expect(fs.promises.readFile).toHaveBeenCalledTimes(3);
      expect(mockClient.request).toHaveBeenCalledTimes(3);
    });
  });
});
