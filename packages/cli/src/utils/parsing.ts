/**
 * Parsing utilities for CLI input
 * @module utils/parsing
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Parses JSON input from either a string or a file
 * @param data - JSON string to parse (optional)
 * @param dataFile - Path to JSON file to read and parse (optional)
 * @returns Parsed JSON data
 * @throws {Error} If neither data nor dataFile is provided, or if JSON parsing fails
 * @example
 * ```typescript
 * // Parse from string
 * parseJsonInput('{"name": "test"}');
 * // Returns: { name: "test" }
 * 
 * // Parse from file
 * parseJsonInput(undefined, './data.json');
 * // Returns: contents of data.json parsed as JSON
 * ```
 */
export async function parseJsonInput(data?: string, dataFile?: string): Promise<unknown> {
  if (dataFile) {
    const resolved = path.resolve(dataFile);
    // Prevent path traversal: reject paths containing '..' segments
    if (resolved !== path.normalize(resolved) || dataFile.includes("..")) {
      throw new Error(`Invalid file path: '${dataFile}'. Path traversal is not allowed.`);
    }
    const raw = await fs.promises.readFile(resolved, "utf8");
    return JSON.parse(raw);
  }
  if (data) {
    return JSON.parse(data);
  }
  throw new Error("Provide --data or --data-file");
}

/**
 * Parses a key=value string into a tuple
 * @param input - String in format "key=value"
 * @returns Tuple of [key, value]
 * @throws {Error} If input is not in valid key=value format
 * @example
 * ```typescript
 * parseKeyValue("name=Alice");
 * // Returns: ["name", "Alice"]
 * 
 * parseKeyValue("status=active");
 * // Returns: ["status", "active"]
 * 
 * parseKeyValue("invalid");
 * // Throws: Error("Invalid value 'invalid'. Use 'key=value'.")
 * ```
 */
export function parseKeyValue(input: string): [string, string] {
  const idx = input.indexOf("=");
  if (idx === -1) {
    throw new Error(`Invalid value '${input}'. Use 'key=value'.`);
  }
  const key = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!key || !value) {
    throw new Error(`Invalid value '${input}'. Use 'key=value'.`);
  }
  return [key, value];
}

/**
 * Extracts base ID from command line arguments
 * @param argv - Array of command line arguments
 * @returns Base ID if found, undefined otherwise
 * @example
 * ```typescript
 * getBaseIdFromArgv(["--base", "base123"]);
 * // Returns: "base123"
 * 
 * getBaseIdFromArgv(["--base=base456"]);
 * // Returns: "base456"
 * 
 * getBaseIdFromArgv(["--other", "value"]);
 * // Returns: undefined
 * ```
 */
export function getBaseIdFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base" && argv[i + 1]) {
      return argv[i + 1];
    }
    if (arg.startsWith("--base=")) {
      return arg.slice("--base=".length);
    }
  }
  return undefined;
}

/**
 * NocoDB entity ID prefixes and their expected patterns.
 * IDs are typically a prefix letter followed by alphanumeric characters.
 */
const ID_PATTERNS: Record<string, RegExp> = {
  table: /^[a-z][a-z0-9]{15,}$/i,
  base: /^[a-z][a-z0-9]{15,}$/i,
  view: /^[a-z][a-z0-9]{15,}$/i,
  column: /^[a-z][a-z0-9]{15,}$/i,
};

/**
 * Validates that a string looks like a valid NocoDB entity ID or alias.
 * Rejects obviously invalid inputs (empty, whitespace-only, containing path separators).
 * 
 * @param id - The ID or alias string to validate
 * @param entityType - Optional entity type for context in error messages
 * @returns The trimmed ID string
 * @throws {Error} If the ID is clearly invalid
 * @example
 * ```typescript
 * validateEntityId("t1234567890abcdef", "table");
 * // Returns: "t1234567890abcdef"
 * 
 * validateEntityId("", "table");
 * // Throws: Error("Invalid table ID: cannot be empty")
 * 
 * validateEntityId("my-alias", "table");
 * // Returns: "my-alias" (aliases are allowed)
 * ```
 */
export function validateEntityId(id: string, entityType = "entity"): string {
  const trimmed = id.trim();
  if (!trimmed) {
    throw new Error(`Invalid ${entityType} ID: cannot be empty`);
  }
  // Reject IDs with path separators (potential injection)
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error(`Invalid ${entityType} ID: '${trimmed}' contains invalid characters`);
  }
  // Reject excessively long IDs (likely malformed input)
  if (trimmed.length > 255) {
    throw new Error(`Invalid ${entityType} ID: exceeds maximum length`);
  }
  return trimmed;
}
