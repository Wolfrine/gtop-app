#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { z } from "zod";
import {
  assertBatchSize,
  assertCollectionPath,
  assertDeleteConfirmation,
  assertDocumentPath,
  boundedLimit,
} from "./safety.js";
import {
  timestampFromUpdateToken,
  updateTokenFromTimestamp,
} from "./version-token.js";

const projectId =
  process.env["GTOP_FIREBASE_PROJECT_ID"] ||
  process.env["GOOGLE_CLOUD_PROJECT"] ||
  "gtop-app";
const actor = process.env["GTOP_MCP_ACTOR"] || "Codex agent";
const taskReference = process.env["GTOP_MCP_TASK_REF"] || "unattributed-task";
const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

const server = new McpServer(
  { name: "gtop-firestore", version: "1.0.0" },
  {
    instructions:
      "Use action_plan tools for GTOP delivery coordination before generic Firestore tools. Generic writes affect live production data. Read before writing, use update-time preconditions, keep queries bounded, and attach the active branch, PR, commit, or task reference to progress updates.",
  },
);

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;
const destructive = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;
const json = (value: unknown) => ({
  content: [
    { type: "text" as const, text: JSON.stringify(serialize(value), null, 2) },
  ],
});
const message = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp)
    return {
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serialize(child)]),
    );
  return value;
}

async function snapshot(path: string): Promise<Record<string, unknown> | null> {
  const item = await db.doc(path).get();
  return item.exists
    ? {
        id: item.id,
        path: item.ref.path,
        updateTime: item.updateTime?.toDate().toISOString(),
        updateToken: item.updateTime
          ? updateTokenFromTimestamp(item.updateTime)
          : undefined,
        ...item.data(),
      }
    : null;
}

async function audit(
  tool: string,
  target: string,
  before: unknown,
  after: unknown,
  input: unknown,
): Promise<void> {
  await db.collection("mcpAuditLog").add({
    actor,
    taskReference,
    tool,
    target,
    before: serialize(before),
    after: serialize(after),
    input: serialize(input),
    createdAt: FieldValue.serverTimestamp(),
  });
}

const actorSchema = z
  .object({
    uid: z.string().optional(),
    name: z.string().min(1).default(actor),
    email: z.string().optional(),
    kind: z.enum(["user", "agent", "system"]).default("agent"),
  })
  .default({ name: actor, kind: "agent" });
const workStatus = z.enum([
  "planned",
  "in-progress",
  "blocked",
  "review",
  "done",
]);
const workPriority = z.enum(["critical", "high", "medium", "low"]);
const writeOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    path: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    operation: z.literal("update"),
    path: z.string(),
    expectedUpdateToken: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    operation: z.literal("delete"),
    path: z.string(),
    expectedUpdateToken: z.string().min(1),
    confirmation: z.string(),
  }),
]);
const releaseVersionSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    "Use a valid semantic version.",
  );
const releaseCommitSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Use the full 40-character commit SHA.");

server.registerTool(
  "action_plan_list",
  {
    title: "List GTOP action plan",
    description: "List and filter canonical GTOP action-plan items.",
    inputSchema: {
      status: workStatus.optional(),
      owner: z.string().optional(),
      search: z.string().optional(),
      includeArchived: z.boolean().default(false),
      limit: z.number().int().positive().max(200).default(100),
    },
    annotations: readOnly,
  },
  async ({ status, owner, search, includeArchived, limit }) => {
    let query: FirebaseFirestore.Query = db.collection("actionPlans");
    if (status) query = query.where("status", "==", status);
    const result = await query.limit(limit).get();
    const needle = search?.toLowerCase();
    const items = result.docs
      .map((item) => ({
        id: item.id,
        updateTime: item.updateTime.toDate().toISOString(),
        updateToken: updateTokenFromTimestamp(item.updateTime),
        ...item.data(),
      }))
      .filter(
        (item: Record<string, unknown>) =>
          (includeArchived || !item["archived"]) &&
          (!owner ||
            String(item["owner"] ?? "")
              .toLowerCase()
              .includes(owner.toLowerCase())) &&
          (!needle || JSON.stringify(item).toLowerCase().includes(needle)),
      );
    return json(items);
  },
);

server.registerTool(
  "action_plan_get",
  {
    title: "Get action-plan item",
    description: "Read one action-plan item and its immutable update timeline.",
    inputSchema: {
      id: z.string().min(1),
      updateLimit: z.number().int().positive().max(200).default(100),
    },
    annotations: readOnly,
  },
  async ({ id, updateLimit }) => {
    const item = await snapshot(assertDocumentPath(`actionPlans/${id}`));
    if (!item) throw new Error("Action-plan item not found.");
    const updates = await db
      .collection(`actionPlans/${id}/updates`)
      .orderBy("createdAt", "desc")
      .limit(updateLimit)
      .get();
    return json({
      item,
      updates: updates.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    });
  },
);

server.registerTool(
  "action_plan_create",
  {
    title: "Create action-plan item",
    description:
      "Create canonical GTOP work with ownership and acceptance criteria.",
    inputSchema: {
      title: z.string().min(1).max(120),
      description: z.string().min(1).max(2000),
      area: z.string().min(1).max(100),
      owner: z.string().min(1).max(160),
      status: workStatus.default("planned"),
      priority: workPriority.default("medium"),
      milestone: z.string().optional(),
      labels: z.array(z.string()).default([]),
      dependencies: z.array(z.string()).default([]),
      acceptanceCriteria: z.array(z.string()).default([]),
      sourceReferences: z.array(z.string()).default([]),
      dueDate: z.string().nullable().optional(),
      actor: actorSchema,
    },
    annotations: write,
  },
  async (input) => {
    const ref = db.collection("actionPlans").doc();
    const value = {
      ...input,
      archived: false,
      latestUpdate: "Activity created through GTOP MCP.",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: input.actor,
      updatedBy: input.actor,
    };
    await ref.create(value);
    await ref.collection("updates").add({
      message: "Activity created through GTOP MCP.",
      type: "progress",
      actor: input.actor,
      sourceReference: taskReference,
      createdAt: FieldValue.serverTimestamp(),
    });
    const after = await snapshot(ref.path);
    await audit("action_plan_create", ref.path, null, after, input);
    return json(after);
  },
);

server.registerTool(
  "action_plan_update",
  {
    title: "Update action-plan item",
    description:
      "Update fields using a required Firestore update-time precondition.",
    inputSchema: {
      id: z.string().min(1),
      expectedUpdateToken: z.string().min(1),
      changes: z.record(z.string(), z.unknown()),
      progressMessage: z.string().min(1).max(2000),
      actor: actorSchema,
    },
    annotations: write,
  },
  async (input) => {
    const path = assertDocumentPath(`actionPlans/${input.id}`);
    const before = await snapshot(path);
    if (!before) throw new Error("Action-plan item not found.");
    const changes = { ...input.changes };
    delete changes["id"];
    delete changes["createdAt"];
    delete changes["createdBy"];
    await db.doc(path).update(
      {
        ...changes,
        latestUpdate: input.progressMessage,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actor,
      },
      {
        lastUpdateTime: timestampFromUpdateToken(input.expectedUpdateToken),
      },
    );
    await db.collection(`${path}/updates`).add({
      message: input.progressMessage,
      type: "progress",
      actor: input.actor,
      sourceReference: taskReference,
      createdAt: FieldValue.serverTimestamp(),
    });
    const after = await snapshot(path);
    await audit("action_plan_update", path, before, after, input);
    return json(after);
  },
);

server.registerTool(
  "action_plan_add_update",
  {
    title: "Add action-plan progress",
    description:
      "Append an immutable progress, blocker, review, or completion update.",
    inputSchema: {
      id: z.string().min(1),
      expectedUpdateToken: z.string().min(1),
      message: z.string().min(1).max(2000),
      type: z
        .enum(["progress", "status", "blocker", "review", "completion"])
        .default("progress"),
      fromStatus: workStatus.optional(),
      toStatus: workStatus.optional(),
      sourceReference: z.string().optional(),
      actor: actorSchema,
    },
    annotations: write,
  },
  async (input) => {
    const path = assertDocumentPath(`actionPlans/${input.id}`);
    const before = await snapshot(path);
    if (!before) throw new Error("Action-plan item not found.");
    const parentChanges: Record<string, unknown> = {
      latestUpdate: input.message,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: input.actor,
    };
    if (input.toStatus) parentChanges["status"] = input.toStatus;
    await db.doc(path).update(parentChanges, {
      lastUpdateTime: timestampFromUpdateToken(input.expectedUpdateToken),
    });
    await db.collection(`${path}/updates`).add({
      message: input.message,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      sourceReference: input.sourceReference ?? taskReference,
      actor: input.actor,
      createdAt: FieldValue.serverTimestamp(),
    });
    const after = await snapshot(path);
    await audit("action_plan_add_update", path, before, after, input);
    return json(after);
  },
);

server.registerTool(
  "app_version_get",
  {
    title: "Get required GTOP version",
    description:
      "Read the canonical production release requirement from Meta/version.",
    inputSchema: {},
    annotations: readOnly,
  },
  async () => json(await snapshot("Meta/version")),
);

server.registerTool(
  "app_version_publish",
  {
    title: "Publish required GTOP version",
    description:
      "Publish a successfully deployed production release to Meta/version with an immutable release record and MCP audit entry.",
    inputSchema: {
      version: releaseVersionSchema,
      commit: releaseCommitSchema,
      channel: z.literal("production"),
      releaseReference: z.string().min(1).max(500),
      expectedUpdateToken: z.string().min(1).optional(),
      actor: actorSchema,
    },
    annotations: write,
  },
  async (input) => {
    const path = "Meta/version";
    const ref = db.doc(path);
    const before = await snapshot(path);
    if (before && !input.expectedUpdateToken)
      throw new Error(
        "expectedUpdateToken is required because Meta/version already exists.",
      );
    if (!before && input.expectedUpdateToken)
      throw new Error(
        "Do not provide expectedUpdateToken when creating Meta/version.",
      );
    if (
      before?.["version"] === input.version &&
      before?.["commit"] === input.commit
    )
      return json(before);

    const publishedAt = Timestamp.now();
    const releaseRef = ref.collection("releases").doc();
    const value = {
      version: input.version,
      commit: input.commit,
      channel: input.channel,
      releaseReference: input.releaseReference,
      previousVersion: before?.["version"] ?? null,
      previousCommit: before?.["commit"] ?? null,
      updatedBy: input.actor,
      updatedAt: publishedAt,
    };
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (before) {
        const expected = timestampFromUpdateToken(input.expectedUpdateToken!);
        if (!current.exists || !current.updateTime?.isEqual(expected))
          throw new Error(
            "Meta/version changed after it was read. Read it again before publishing.",
          );
        transaction.update(ref, value);
      } else {
        if (current.exists)
          throw new Error("Meta/version was created after it was read.");
        transaction.create(ref, value);
      }
      transaction.create(releaseRef, { ...value, createdAt: publishedAt });
    });
    const after = await snapshot(path);
    await audit("app_version_publish", path, before, after, input);
    return json(after);
  },
);

server.registerTool(
  "firestore_list_collections",
  {
    title: "List Firestore collections",
    description: "List root or document subcollections.",
    inputSchema: { documentPath: z.string().optional() },
    annotations: readOnly,
  },
  async ({ documentPath }) => {
    const collections = documentPath
      ? await db.doc(assertDocumentPath(documentPath)).listCollections()
      : await db.listCollections();
    return json(collections.map((item) => item.path));
  },
);

server.registerTool(
  "firestore_get_document",
  {
    title: "Get Firestore document",
    description: "Read a document with its update time.",
    inputSchema: { path: z.string().min(1) },
    annotations: readOnly,
  },
  async ({ path }) => json(await snapshot(assertDocumentPath(path))),
);

server.registerTool(
  "firestore_query",
  {
    title: "Query Firestore collection",
    description:
      "Run a bounded single-collection query. The default and maximum limits prevent accidental database scans.",
    inputSchema: {
      collectionPath: z.string().min(1),
      filters: z
        .array(
          z.object({
            field: z.string().min(1),
            op: z.enum([
              "==",
              "!=",
              "<",
              "<=",
              ">",
              ">=",
              "array-contains",
              "in",
              "not-in",
              "array-contains-any",
            ]),
            value: z.unknown(),
          }),
        )
        .max(10)
        .default([]),
      orderBy: z
        .object({
          field: z.string(),
          direction: z.enum(["asc", "desc"]).default("asc"),
        })
        .optional(),
      limit: z.number().int().positive().optional(),
    },
    annotations: readOnly,
  },
  async ({ collectionPath, filters, orderBy: order, limit }) => {
    let q: FirebaseFirestore.Query = db.collection(
      assertCollectionPath(collectionPath),
    );
    for (const filter of filters)
      q = q.where(filter.field, filter.op, filter.value);
    if (order) q = q.orderBy(order.field, order.direction);
    const result = await q.limit(boundedLimit(limit)).get();
    return json(
      result.docs.map((item) => ({
        id: item.id,
        path: item.ref.path,
        updateTime: item.updateTime.toDate().toISOString(),
        updateToken: updateTokenFromTimestamp(item.updateTime),
        ...item.data(),
      })),
    );
  },
);

server.registerTool(
  "firestore_create_document",
  {
    title: "Create Firestore document",
    description: "Create a new document at an explicit unused path.",
    inputSchema: {
      path: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
    annotations: write,
  },
  async (input) => {
    const path = assertDocumentPath(input.path);
    await db.doc(path).create({
      ...input.data,
      createdAt: input.data["createdAt"] ?? FieldValue.serverTimestamp(),
      updatedAt: input.data["updatedAt"] ?? FieldValue.serverTimestamp(),
    });
    const after = await snapshot(path);
    await audit("firestore_create_document", path, null, after, input);
    return json(after);
  },
);

server.registerTool(
  "firestore_update_document",
  {
    title: "Update Firestore document",
    description:
      "Update an existing document using a required update-time precondition.",
    inputSchema: {
      path: z.string().min(1),
      expectedUpdateToken: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
    annotations: write,
  },
  async (input) => {
    const path = assertDocumentPath(input.path);
    const before = await snapshot(path);
    if (!before) throw new Error("Document not found.");
    await db.doc(path).update(
      { ...input.data, updatedAt: FieldValue.serverTimestamp() },
      {
        lastUpdateTime: timestampFromUpdateToken(input.expectedUpdateToken),
      },
    );
    const after = await snapshot(path);
    await audit("firestore_update_document", path, before, after, input);
    return json(after);
  },
);

server.registerTool(
  "firestore_batch_write",
  {
    title: "Batch Firestore writes",
    description:
      "Atomically create, update, or delete up to 20 explicit document paths. Updates and deletes require update-time preconditions.",
    inputSchema: { writes: z.array(writeOperationSchema).max(20) },
    annotations: destructive,
  },
  async (input) => {
    assertBatchSize(input.writes);
    const batch = db.batch();
    const before: Record<string, unknown> = {};
    for (const item of input.writes) {
      const path = assertDocumentPath(item.path);
      before[path] = await snapshot(path);
      const ref = db.doc(path);
      if (item.operation === "create") batch.create(ref, item.data);
      if (item.operation === "update")
        batch.update(ref, item.data, {
          lastUpdateTime: timestampFromUpdateToken(item.expectedUpdateToken),
        });
      if (item.operation === "delete") {
        assertDeleteConfirmation(path, item.confirmation);
        batch.delete(ref, {
          lastUpdateTime: timestampFromUpdateToken(item.expectedUpdateToken),
        });
      }
    }
    await batch.commit();
    await audit(
      "firestore_batch_write",
      input.writes.map((item) => item.path).join(", "),
      before,
      null,
      input,
    );
    return message(`Committed ${input.writes.length} writes.`);
  },
);

server.registerTool(
  "firestore_transaction",
  {
    title: "Run Firestore transaction",
    description:
      "Assert document update times, then atomically create, update, or delete up to 20 explicit paths.",
    inputSchema: {
      assertions: z
        .array(
          z.object({
            path: z.string(),
            expectedUpdateToken: z.string().min(1),
          }),
        )
        .min(1)
        .max(20),
      writes: z.array(writeOperationSchema).max(20),
    },
    annotations: destructive,
  },
  async (input) => {
    assertBatchSize(input.writes);
    await db.runTransaction(async (transaction) => {
      const assertionRefs = input.assertions.map((item) => ({
        item,
        ref: db.doc(assertDocumentPath(item.path)),
      }));
      const assertionSnapshots = await transaction.getAll(
        ...assertionRefs.map(({ ref }) => ref),
      );
      assertionSnapshots.forEach((current, index) => {
        const expected = timestampFromUpdateToken(
          assertionRefs[index].item.expectedUpdateToken,
        );
        if (!current.exists || !current.updateTime?.isEqual(expected))
          throw new Error(
            `Transaction assertion failed for ${assertionRefs[index].ref.path}.`,
          );
      });
      for (const item of input.writes) {
        const path = assertDocumentPath(item.path);
        const ref = db.doc(path);
        if (item.operation === "create") transaction.create(ref, item.data);
        if (item.operation === "update")
          transaction.update(ref, item.data, {
            lastUpdateTime: timestampFromUpdateToken(item.expectedUpdateToken),
          });
        if (item.operation === "delete") {
          assertDeleteConfirmation(path, item.confirmation);
          transaction.delete(ref, {
            lastUpdateTime: timestampFromUpdateToken(item.expectedUpdateToken),
          });
        }
      }
    });
    await audit(
      "firestore_transaction",
      input.writes.map((item) => item.path).join(", "),
      null,
      null,
      input,
    );
    return message(
      `Committed transaction with ${input.writes.length} writes after ${input.assertions.length} assertions.`,
    );
  },
);

server.registerTool(
  "firestore_delete_document",
  {
    title: "Delete Firestore document",
    description:
      "Permanently delete one explicit document using confirmation and an update-time precondition. This does not recursively delete subcollections.",
    inputSchema: {
      path: z.string().min(1),
      expectedUpdateToken: z.string().min(1),
      confirmation: z.string(),
    },
    annotations: destructive,
  },
  async (input) => {
    const path = assertDocumentPath(input.path);
    assertDeleteConfirmation(path, input.confirmation);
    const before = await snapshot(path);
    if (!before) throw new Error("Document not found.");
    await db.doc(path).delete({
      lastUpdateTime: timestampFromUpdateToken(input.expectedUpdateToken),
    });
    await audit("firestore_delete_document", path, before, null, input);
    return message(
      `Deleted ${path}. Subcollections, if any, were not recursively deleted.`,
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
