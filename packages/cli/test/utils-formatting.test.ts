import { describe, it, expect } from "vitest";
import { formatJson, formatCsv, formatTable } from "../src/utils/formatting.js";

describe("formatJson", () => {
  it("should format data as compact JSON when pretty is false", () => {
    const data = { name: "test", value: 123 };
    const result = formatJson(data, false);
    expect(result).toBe('{"name":"test","value":123}');
  });

  it("should format data as pretty JSON when pretty is true", () => {
    const data = { name: "test", value: 123 };
    const result = formatJson(data, true);
    expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
  });

  it("should handle arrays", () => {
    const data = [1, 2, 3];
    const result = formatJson(data, false);
    expect(result).toBe("[1,2,3]");
  });

  it("should handle null values", () => {
    const data = { name: null };
    const result = formatJson(data, false);
    expect(result).toBe('{"name":null}');
  });

  it("should handle nested objects", () => {
    const data = { outer: { inner: "value" } };
    const result = formatJson(data, true);
    expect(result).toContain('"outer"');
    expect(result).toContain('"inner"');
    expect(result).toContain('"value"');
  });
});

describe("formatCsv", () => {
  it("should format array of objects as CSV", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const result = formatCsv(data);
    expect(result).toBe("name,age\nAlice,30\nBob,25");
  });

  it("should return empty string for empty array", () => {
    const result = formatCsv([]);
    expect(result).toBe("");
  });

  it("should handle object with list property", () => {
    const data = {
      list: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ],
    };
    const result = formatCsv(data);
    expect(result).toBe("name,age\nAlice,30\nBob,25");
  });

  it("should handle single object", () => {
    const data = { name: "Alice", age: 30 };
    const result = formatCsv(data);
    expect(result).toBe("name,age\nAlice,30");
  });

  it("should escape fields with commas", () => {
    const data = [{ name: "Smith, John", age: 30 }];
    const result = formatCsv(data);
    expect(result).toBe('name,age\n"Smith, John",30');
  });

  it("should escape fields with quotes", () => {
    const data = [{ name: 'John "Johnny" Doe', age: 30 }];
    const result = formatCsv(data);
    expect(result).toBe('name,age\n"John ""Johnny"" Doe",30');
  });

  it("should escape fields with newlines", () => {
    const data = [{ name: "Line1\nLine2", age: 30 }];
    const result = formatCsv(data);
    expect(result).toBe('name,age\n"Line1\nLine2",30');
  });

  it("should handle null and undefined values", () => {
    const data = [{ name: "Alice", age: null, city: undefined }];
    const result = formatCsv(data);
    expect(result).toBe("name,age,city\nAlice,,");
  });

  it("should handle objects with different keys", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", city: "NYC" },
    ];
    const result = formatCsv(data);
    const lines = result.split("\n");
    expect(lines[0]).toContain("name");
    expect(lines[0]).toContain("age");
    expect(lines[0]).toContain("city");
  });

  it("should handle primitive values", () => {
    const data = 42;
    const result = formatCsv(data);
    expect(result).toBe("value\n42");
  });
});

describe("formatTable", () => {
  it("should format array of objects as table", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const result = formatTable(data);
    expect(result).toContain("| name");
    expect(result).toContain("| age");
    expect(result).toContain("| Alice");
    expect(result).toContain("| Bob");
    expect(result).toContain("|-");
  });

  it("should return (empty) for empty array", () => {
    const result = formatTable([]);
    expect(result).toBe("(empty)");
  });

  it("should handle object with list property", () => {
    const data = {
      list: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ],
    };
    const result = formatTable(data);
    expect(result).toContain("| name");
    expect(result).toContain("| Alice");
    expect(result).toContain("| Bob");
  });

  it("should handle single object", () => {
    const data = { name: "Alice", age: 30 };
    const result = formatTable(data);
    expect(result).toContain("| name");
    expect(result).toContain("| age");
    expect(result).toContain("| Alice");
    expect(result).toContain("| 30");
  });

  it("should truncate long values", () => {
    const longValue = "a".repeat(50);
    const data = [{ name: longValue }];
    const result = formatTable(data);
    expect(result).toContain("...");
    expect(result).not.toContain("a".repeat(50));
  });

  it("should handle null and undefined values", () => {
    const data = [{ name: "Alice", age: null, city: undefined }];
    const result = formatTable(data);
    expect(result).toContain("| Alice");
    expect(result).toContain("|     |"); // Empty cells for null/undefined (with padding)
  });

  it("should align columns properly", () => {
    const data = [
      { name: "A", age: 1 },
      { name: "Bob", age: 25 },
    ];
    const result = formatTable(data);
    const lines = result.split("\n");
    // All lines should have same structure with proper padding
    const firstDataLine = lines[2];
    const secondDataLine = lines[3];
    expect(firstDataLine.indexOf("|", 1)).toBe(secondDataLine.indexOf("|", 1));
  });

  it("should handle objects with different keys", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", city: "NYC" },
    ];
    const result = formatTable(data);
    expect(result).toContain("name");
    expect(result).toContain("age");
    expect(result).toContain("city");
  });

  it("should handle primitive values", () => {
    const data = 42;
    const result = formatTable(data);
    expect(result).toContain("value");
    expect(result).toContain("42");
  });
});
