import { describe, it, expect, vi, afterEach } from "vitest";
import { printResult } from "../src/utils/command-utils.js";

describe("printResult --select filtering", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    logSpy?.mockRestore();
    delete process.env.NOCO_QUIET;
  });

  function captureOutput(fn: () => void): string {
    const lines: string[] = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    fn();
    return lines.join("\n");
  }

  it("should filter fields on a plain object", () => {
    const data = { id: "b1", title: "Base1", extra: "x" };
    const output = captureOutput(() => printResult(data, { select: "id,title" }));
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({ id: "b1", title: "Base1" });
    expect(parsed).not.toHaveProperty("extra");
  });

  it("should filter fields on a ListResponse wrapper", () => {
    const data = { list: [{ id: "b1", title: "Base1", extra: "x" }], pageInfo: {} };
    const output = captureOutput(() => printResult(data, { select: "title" }));
    const parsed = JSON.parse(output);
    expect(parsed.list).toEqual([{ title: "Base1" }]);
    expect(parsed.pageInfo).toEqual({});
  });

  it("should filter fields on a plain array", () => {
    const data = [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 },
    ];
    const output = captureOutput(() => printResult(data, { select: "name" }));
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([{ name: "Alice" }, { name: "Bob" }]);
  });

  it("should handle spaces in select fields", () => {
    const data = { id: "1", title: "Test", status: "active" };
    const output = captureOutput(() => printResult(data, { select: "id, title" }));
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({ id: "1", title: "Test" });
  });

  it("should ignore non-existent fields gracefully", () => {
    const data = { id: "1", title: "Test" };
    const output = captureOutput(() => printResult(data, { select: "id,nonexistent" }));
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({ id: "1" });
  });

  it("should work with csv format", () => {
    const data = [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 },
    ];
    const output = captureOutput(() => printResult(data, { select: "name,age", format: "csv" }));
    expect(output).toContain("name,age");
    expect(output).toContain("Alice,30");
    expect(output).not.toContain("id");
  });

  it("should work with table format", () => {
    const data = [{ id: "1", name: "Alice", age: 30 }];
    const output = captureOutput(() => printResult(data, { select: "name", format: "table" }));
    expect(output).toContain("name");
    expect(output).toContain("Alice");
    expect(output).not.toContain("id");
    expect(output).not.toContain("age");
  });

  it("should pass through non-object data unchanged", () => {
    const output = captureOutput(() => printResult("hello", { select: "anything" }));
    expect(output).toBe('"hello"');
  });

  it("should return all fields when select is not provided", () => {
    const data = { id: "1", title: "Test", extra: "x" };
    const output = captureOutput(() => printResult(data, {}));
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({ id: "1", title: "Test", extra: "x" });
  });
});
