import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, parseHeader } from "../src/index.js";

describe("normalizeBaseUrl", () => {
  it("removes trailing slashes", () => {
    expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeBaseUrl("https://example.com///")).toBe("https://example.com");
  });
});

describe("parseHeader", () => {
  it("parses a header pair", () => {
    expect(parseHeader("xc-token: abc")).toEqual(["xc-token", "abc"]);
  });

  it("rejects invalid header values", () => {
    expect(() => parseHeader("badheader")).toThrow("Invalid header");
    expect(() => parseHeader("x:")).toThrow("Invalid header");
    expect(() => parseHeader(":y")).toThrow("Invalid header");
    expect(() => parseHeader(" : ")).toThrow("Invalid header");
  });
});
