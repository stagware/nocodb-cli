import { test, expect } from "vitest";
import { resolveNamespacedAlias, type MultiConfig } from "../src/aliases.js";

const mockConfig: MultiConfig = {
  kb: {
    baseUrl: "https://noco.kb.com",
    headers: { "xc-token": "kb-token" },
    baseId: "kb-base-id",
    aliases: {
      prayer: "prayer-table-id",
      people: "people-table-id"
    }
  },
  work: {
    baseUrl: "https://noco.work.com",
    headers: { "xc-token": "work-token" },
    baseId: "work-base-id",
    aliases: {
      tasks: "tasks-table-id"
    }
  }
};

test("resolves explicit namespaced alias (kb.prayer)", () => {
  const result = resolveNamespacedAlias("kb.prayer", mockConfig);
  expect(result.id).toBe("prayer-table-id");
  expect(result.workspace?.baseUrl).toBe("https://noco.kb.com");
});

test("resolves alias within current workspace context", () => {
  const result = resolveNamespacedAlias("tasks", mockConfig, "work");
  expect(result.id).toBe("tasks-table-id");
  expect(result.workspace?.baseUrl).toBe("https://noco.work.com");
});

test("resolves workspace name to its baseId", () => {
  const result = resolveNamespacedAlias("kb", mockConfig);
  expect(result.id).toBe("kb-base-id");
  expect(result.workspace?.baseUrl).toBe("https://noco.kb.com");
});

test("returns input as-is if no alias matches", () => {
  const result = resolveNamespacedAlias("unknown-id", mockConfig);
  expect(result.id).toBe("unknown-id");
  expect(result.workspace).toBeUndefined();
});

test("returns input as-is if workspace exists but alias doesn't", () => {
  const result = resolveNamespacedAlias("kb.unknown", mockConfig);
  expect(result.id).toBe("kb.unknown");
});
