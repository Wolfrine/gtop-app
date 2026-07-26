import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const requiredTools = [
  "action_plan_list",
  "action_plan_get",
  "action_plan_create",
  "action_plan_update",
  "action_plan_add_update",
  "app_version_get",
  "app_version_publish",
  "firestore_list_collections",
  "firestore_get_document",
  "firestore_query",
  "firestore_create_document",
  "firestore_update_document",
  "firestore_batch_write",
  "firestore_transaction",
  "firestore_delete_document",
];

describe("GTOP MCP contract", () => {
  it.each(requiredTools)("registers %s", (name) => {
    expect(source).toMatch(new RegExp(`registerTool\\(\\s*["']${name}["']`));
  });

  it("marks batch, transaction, and delete operations as destructive", () => {
    for (const name of [
      "firestore_batch_write",
      "firestore_transaction",
      "firestore_delete_document",
    ]) {
      const registration = toolRegistration(name, 2400);
      expect(registration).toContain("annotations: destructive");
    }
  });

  it("publishes the canonical app version as an audited write", () => {
    const registration = toolRegistration("app_version_publish", 4200);
    expect(registration).toContain("annotations: write");
    expect(registration).toMatch(/await audit\(["']app_version_publish["']/);
    expect(registration).toMatch(/ref\.collection\(["']releases["']\)/);
  });

  it("uses full-precision opaque tokens for Firestore update preconditions", () => {
    expect(source).toContain("updateTokenFromTimestamp");
    expect(source).toContain("timestampFromUpdateToken");
    expect(source).not.toContain(
      "Timestamp.fromDate(new Date(input.expectedUpdateTime))",
    );
  });
});

function toolRegistration(name: string, length: number): string {
  const match = new RegExp(`registerTool\\(\\s*["']${name}["']`).exec(source);
  expect(match, `${name} registration`).not.toBeNull();
  return source.slice(match!.index, match!.index + length);
}
