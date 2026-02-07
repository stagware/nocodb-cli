import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseJsonInput, parseKeyValue, getBaseIdFromArgv, parseCsv } from "../src/utils/parsing.js";

describe("parseJsonInput", () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-test-"));
    tempFile = path.join(tempDir, "test.json");
  });

  afterEach(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it("should parse JSON from data string", async () => {
    const result = await parseJsonInput('{"name": "test", "value": 123}');
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should parse JSON from file", async () => {
    const data = { name: "test", value: 123 };
    fs.writeFileSync(tempFile, JSON.stringify(data), "utf8");
    const result = await parseJsonInput(undefined, tempFile);
    expect(result).toEqual(data);
  });

  it("should prefer file over data string when both provided", async () => {
    const fileData = { source: "file" };
    const stringData = '{"source": "string"}';
    fs.writeFileSync(tempFile, JSON.stringify(fileData), "utf8");
    const result = await parseJsonInput(stringData, tempFile);
    expect(result).toEqual(fileData);
  });

  it("should throw error when neither data nor file provided", async () => {
    await expect(parseJsonInput()).rejects.toThrow("Provide --data or --data-file");
  });

  it("should throw error for invalid JSON in data string", async () => {
    await expect(parseJsonInput("{invalid json}")).rejects.toThrow();
  });

  it("should throw error for invalid JSON in file", async () => {
    fs.writeFileSync(tempFile, "{invalid json}", "utf8");
    await expect(parseJsonInput(undefined, tempFile)).rejects.toThrow();
  });

  it("should throw error for non-existent file", async () => {
    await expect(parseJsonInput(undefined, "/non/existent/file.json")).rejects.toThrow();
  });

  it("should handle arrays", async () => {
    const result = await parseJsonInput('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it("should handle nested objects", async () => {
    const data = '{"outer": {"inner": "value"}}';
    const result = await parseJsonInput(data);
    expect(result).toEqual({ outer: { inner: "value" } });
  });

  it("should handle null values", async () => {
    const result = await parseJsonInput('{"name": null}');
    expect(result).toEqual({ name: null });
  });
});

describe("parseKeyValue", () => {
  it("should parse valid key=value string", () => {
    const [key, value] = parseKeyValue("name=Alice");
    expect(key).toBe("name");
    expect(value).toBe("Alice");
  });

  it("should parse key=value with spaces", () => {
    const [key, value] = parseKeyValue("name = Alice");
    expect(key).toBe("name");
    expect(value).toBe("Alice");
  });

  it("should handle value with equals sign", () => {
    const [key, value] = parseKeyValue("formula=a=b");
    expect(key).toBe("formula");
    expect(value).toBe("a=b");
  });

  it("should handle empty value after equals", () => {
    expect(() => parseKeyValue("name=")).toThrow("Invalid value 'name='. Use 'key=value'.");
  });

  it("should handle empty key before equals", () => {
    expect(() => parseKeyValue("=value")).toThrow("Invalid value '=value'. Use 'key=value'.");
  });

  it("should throw error for missing equals sign", () => {
    expect(() => parseKeyValue("nameAlice")).toThrow("Invalid value 'nameAlice'. Use 'key=value'.");
  });

  it("should handle value with special characters", () => {
    const [key, value] = parseKeyValue("url=https://example.com/path?query=1");
    expect(key).toBe("url");
    expect(value).toBe("https://example.com/path?query=1");
  });

  it("should handle numeric values", () => {
    const [key, value] = parseKeyValue("age=30");
    expect(key).toBe("age");
    expect(value).toBe("30");
  });

  it("should handle boolean-like values", () => {
    const [key, value] = parseKeyValue("active=true");
    expect(key).toBe("active");
    expect(value).toBe("true");
  });

  it("should trim whitespace from key and value", () => {
    const [key, value] = parseKeyValue("  name  =  Alice  ");
    expect(key).toBe("name");
    expect(value).toBe("Alice");
  });
});

describe("getBaseIdFromArgv", () => {
  it("should extract base ID from --base flag", () => {
    const argv = ["--base", "base123", "--other", "value"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("base123");
  });

  it("should extract base ID from --base=value format", () => {
    const argv = ["--base=base456", "--other", "value"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("base456");
  });

  it("should return undefined when --base not present", () => {
    const argv = ["--other", "value", "--another", "flag"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBeUndefined();
  });

  it("should return undefined when --base has no value", () => {
    const argv = ["--base"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBeUndefined();
  });

  it("should return first occurrence when multiple --base flags", () => {
    const argv = ["--base", "base123", "--base", "base456"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("base123");
  });

  it("should handle empty argv", () => {
    const result = getBaseIdFromArgv([]);
    expect(result).toBeUndefined();
  });

  it("should handle --base at end of argv", () => {
    const argv = ["--other", "value", "--base", "base789"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("base789");
  });

  it("should handle --base= with empty value", () => {
    const argv = ["--base="];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("");
  });

  it("should handle base ID with special characters", () => {
    const argv = ["--base", "base-123_abc"];
    const result = getBaseIdFromArgv(argv);
    expect(result).toBe("base-123_abc");
  });
});

describe("parseCsv", () => {
  it("should parse simple CSV", () => {
    const result = parseCsv("name,age\nAlice,30\nBob,25");
    expect(result).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle quoted fields with commas", () => {
    const result = parseCsv('name,address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak Ave"');
    expect(result).toEqual([
      { name: "Alice", address: "123 Main St, Apt 4" },
      { name: "Bob", address: "456 Oak Ave" },
    ]);
  });

  it("should handle escaped double quotes", () => {
    const result = parseCsv('name,quote\nAlice,"She said ""hello"""\nBob,"He said ""bye"""');
    expect(result).toEqual([
      { name: "Alice", quote: 'She said "hello"' },
      { name: "Bob", quote: 'He said "bye"' },
    ]);
  });

  it("should handle newlines within quoted fields", () => {
    const result = parseCsv('name,bio\nAlice,"Line 1\nLine 2"\nBob,Simple');
    expect(result).toEqual([
      { name: "Alice", bio: "Line 1\nLine 2" },
      { name: "Bob", bio: "Simple" },
    ]);
  });

  it("should throw on empty CSV", () => {
    expect(() => parseCsv("")).toThrow("CSV is empty");
  });

  it("should return empty array for headers-only CSV", () => {
    const result = parseCsv("name,age");
    expect(result).toEqual([]);
  });

  it("should handle missing trailing values", () => {
    const result = parseCsv("a,b,c\n1,2\n4,5,6");
    expect(result).toEqual([
      { a: "1", b: "2", c: "" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("should handle CRLF line endings", () => {
    const result = parseCsv("name,age\r\nAlice,30\r\nBob,25");
    expect(result).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should skip blank lines", () => {
    const result = parseCsv("name,age\nAlice,30\n\nBob,25\n");
    expect(result).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle single column CSV", () => {
    const result = parseCsv("id\n1\n2\n3");
    expect(result).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
  });
});
