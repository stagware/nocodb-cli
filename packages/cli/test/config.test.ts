import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, deleteHeader, getHeaders, setHeader } from "../src/config.js";

const tempDirs: string[] = [];

function makeConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nocodb-cli-test-"));
  tempDirs.push(dir);
  return createConfig(dir);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("config helpers", () => {
  it("stores base settings", () => {
    const config = makeConfig();
    config.set("baseUrl", "http://example.test");
    config.set("baseId", "base123");
    expect(config.get("baseUrl")).toBe("http://example.test");
    expect(config.get("baseId")).toBe("base123");
  });

  it("manages headers", () => {
    const config = makeConfig();
    setHeader(config, "xc-token", "secret");
    expect(getHeaders(config)).toEqual({ "xc-token": "secret" });
    deleteHeader(config, "xc-token");
    expect(getHeaders(config)).toEqual({});
  });
});
