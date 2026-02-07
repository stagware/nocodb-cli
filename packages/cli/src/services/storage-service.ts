/**
 * Storage service for managing file upload operations.
 * 
 * This service provides business logic for file storage operations,
 * specifically handling file uploads to NocoDB. It handles:
 * 
 * - Uploading attachment files with multipart form data
 * - File reading and boundary generation
 * - Proper content-type headers for file uploads
 * 
 * @module services/storage-service
 */

import type { NocoClient } from "@nocodb/sdk";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Response from file upload operation
 */
export interface UploadResponse {
  /** URL or path to the uploaded file */
  url?: string;
  /** File name */
  title?: string;
  /** MIME type */
  mimetype?: string;
  /** File size in bytes */
  size?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Service for managing file storage operations.
 * 
 * The StorageService provides business logic for file upload operations,
 * handling the complexities of multipart form data encoding and file reading.
 * 
 * @example
 * ```typescript
 * // Create a storage service
 * const storageService = new StorageService(client);
 * 
 * // Upload a file
 * const result = await storageService.upload('./photo.jpg');
 * console.log(`Uploaded: ${result.url}`);
 * ```
 */
export class StorageService {
  /**
   * Creates a new StorageService instance.
   * 
   * @param client - NocoClient instance for making API requests
   */
  constructor(private client: NocoClient) {}

  /**
   * Uploads an attachment file to NocoDB storage.
   * 
   * This method reads a file from the local filesystem, encodes it as
   * multipart form data, and uploads it to the NocoDB storage endpoint.
   * The file is uploaded with proper content-type headers and boundary markers.
   * 
   * @param filePath - Path to the file to upload (relative or absolute)
   * @returns Promise resolving to upload response with file metadata
   * @throws {Error} If the file cannot be read or the upload fails
   * 
   * @example
   * ```typescript
   * // Upload a single file
   * const result = await storageService.upload('./documents/report.pdf');
   * console.log(`File uploaded: ${result.url}`);
   * 
   * // Upload with absolute path
   * const result = await storageService.upload('/home/user/photos/image.jpg');
   * ```
   */
  async upload(filePath: string): Promise<UploadResponse> {
    // Extract filename from path
    const fileName = path.basename(filePath);
    
    // Read file content
    const fileContent = await fs.promises.readFile(filePath);
    
    // Generate unique boundary for multipart form data
    const boundary = `----nocodb-${Date.now()}`;
    
    // Construct multipart form data header
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    
    // Construct multipart form data footer
    const footer = `\r\n--${boundary}--\r\n`;
    
    // Combine header, file content, and footer into single buffer
    const body = Buffer.concat([
      Buffer.from(header),
      fileContent,
      Buffer.from(footer),
    ]);
    
    // Upload to NocoDB storage endpoint
    return this.client.request<UploadResponse>(
      "POST",
      "/api/v2/storage/upload",
      {
        body,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      }
    );
  }
}
