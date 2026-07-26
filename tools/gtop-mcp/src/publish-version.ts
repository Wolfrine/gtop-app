#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const version = required("GTOP_RELEASE_VERSION");
const commit = required("GTOP_RELEASE_COMMIT");
const releaseReference = required("GTOP_RELEASE_REFERENCE");
const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: cleanEnvironment(),
  stderr: "inherit",
});
const client = new Client({ name: "gtop-release-publisher", version: "1.0.0" });

try {
  await client.connect(transport);
  const currentResult = await client.callTool({
    name: "app_version_get",
    arguments: {},
  });
  const current = parseToolJson<Record<string, unknown> | null>(currentResult);
  const published = await client.callTool({
    name: "app_version_publish",
    arguments: {
      version,
      commit,
      channel: "production",
      releaseReference,
      expectedUpdateTime: current?.updateTime,
      actor: {
        name: process.env["GTOP_MCP_ACTOR"] || "GTOP production workflow",
        kind: "system",
      },
    },
  });
  if (isToolError(published)) throw new Error(toolText(published));
  process.stdout.write(`${toolText(published)}\n`);
  await completeReleaseWorkstream(client);
} finally {
  await client.close();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function cleanEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

function toolText(result: unknown): string {
  const content =
    result &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray(result.content)
      ? result.content
      : [];
  return content
    .filter((item): item is { type: "text"; text: string } =>
      Boolean(
        item &&
        typeof item === "object" &&
        "type" in item &&
        item.type === "text" &&
        "text" in item &&
        typeof item.text === "string",
      ),
    )
    .map((item) => item.text)
    .join("\n");
}

function parseToolJson<T>(result: unknown): T {
  if (isToolError(result)) throw new Error(toolText(result));
  const text = toolText(result);
  return JSON.parse(text) as T;
}

function isToolError(result: unknown): boolean {
  return Boolean(
    result &&
    typeof result === "object" &&
    "isError" in result &&
    result.isError === true,
  );
}

async function completeReleaseWorkstream(client: Client): Promise<void> {
  const listResult = await client.callTool({
    name: "action_plan_list",
    arguments: {
      search: "V2 UAT validation and release",
      includeArchived: true,
      limit: 20,
    },
  });
  const items = parseToolJson<Array<Record<string, unknown>>>(listResult);
  const item = items.find((candidate) => candidate["v2Key"] === "release");
  if (!item?.["id"] || !item["updateTime"]) {
    process.stderr.write(
      "Release Action Plan workstream was not found; version publish is complete.\n",
    );
    return;
  }
  const update = await client.callTool({
    name: "action_plan_add_update",
    arguments: {
      id: String(item["id"]),
      expectedUpdateTime: String(item["updateTime"]),
      message: `GTOP ${version} was deployed to production and Meta/version was published through MCP at ${releaseReference}.`,
      type: "completion",
      fromStatus: item["status"],
      toStatus: "done",
      sourceReference: releaseReference,
      actor: {
        name: process.env["GTOP_MCP_ACTOR"] || "GTOP production workflow",
        kind: "system",
      },
    },
  });
  if (isToolError(update)) throw new Error(toolText(update));
  process.stdout.write(`${toolText(update)}\n`);
}
