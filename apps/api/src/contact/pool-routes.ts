// Pools API (fork: svnix-solutions/kaneo). Mounted at /api/pool.
// Pools are managed like projects (project:create/update/delete); their field
// definitions need workspace:manage_settings; membership and values reuse the
// task vocabulary (read = task:read, add/edit/remove = task:update).
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { contactAccess } from "./access";
import * as fields from "./fields";
import * as pipelines from "./pipelines";
import * as svc from "./pools";
import {
  addToBoardBody,
  bulkIdsBody,
  bulkMemberValuesBody,
  createFieldBody,
  createPoolBody,
  fieldIdParam,
  linkTaskBody,
  memberTaskParam,
  poolExternalParam,
  poolIdParam,
  poolMemberParam,
  poolSlugParam,
  queryBody,
  setMemberValuesBody,
  taskIdParam,
  updateFieldBody,
  updatePoolBody,
  workspaceIdParam,
} from "./request";
import {
  addToBoardResponseSchema,
  bulkAddResponseSchema,
  bulkRemoveResponseSchema,
  bulkUpdateResponseSchema,
  memberLinkResponseSchema,
  pipelineSchema,
  poolFieldDefinitionSchema,
  poolMemberListSchema,
  poolMemberUpsertSchema,
  poolSchema,
  successSchema,
  taskPoolMemberSchema,
} from "./response";

const tags = ["Pools"];
const json = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listPools",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List pools",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: { 200: jsonResponse("Pools", z.array(poolSchema)) },
});

const createPoolRoute = createRoute({
  method: "post",
  operationId: "createPool",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Create pool",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ project: ["create"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(createPoolBody) },
  responses: {
    200: jsonResponse("Pool", poolSchema),
    409: errorResponse("Slug already used"),
  },
});

const bySlugRoute = createRoute({
  method: "get",
  operationId: "getPoolBySlug",
  path: "/workspace/{workspaceId}/slug/{slug}",
  tags,
  summary: "Get pool by slug",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: poolSlugParam },
  responses: {
    200: jsonResponse("Pool", poolSchema),
    404: errorResponse("Pool not found"),
  },
});

const updateFieldRoute = createRoute({
  method: "put",
  operationId: "updatePoolField",
  path: "/fields/{fieldId}",
  tags,
  summary: "Update pool field",
  middleware: [
    contactAccess.fromField(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: fieldIdParam, body: json(updateFieldBody) },
  responses: {
    200: jsonResponse("Field definition", poolFieldDefinitionSchema),
    404: errorResponse("Not found"),
  },
});

const deleteFieldRoute = createRoute({
  method: "delete",
  operationId: "deletePoolField",
  path: "/fields/{fieldId}",
  tags,
  summary: "Delete pool field",
  description: "Deletes the field and its value on every member.",
  middleware: [
    contactAccess.fromField(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: fieldIdParam },
  responses: { 200: jsonResponse("Deleted", successSchema) },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getPool",
  path: "/{poolId}",
  tags,
  summary: "Get pool",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: poolIdParam },
  responses: {
    200: jsonResponse("Pool", poolSchema),
    404: errorResponse("Pool not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updatePool",
  path: "/{poolId}",
  tags,
  summary: "Update pool",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: poolIdParam, body: json(updatePoolBody) },
  responses: {
    200: jsonResponse("Pool", poolSchema),
    409: errorResponse("Slug already used"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deletePool",
  path: "/{poolId}",
  tags,
  summary: "Delete pool",
  description:
    "Deletes the pool, its fields and its memberships. Contacts are kept.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ project: ["delete"] }),
  ] as const,
  request: { params: poolIdParam },
  responses: { 200: jsonResponse("Deleted", successSchema) },
});

const listFieldsRoute = createRoute({
  method: "get",
  operationId: "listPoolFields",
  path: "/{poolId}/fields",
  tags,
  summary: "List pool fields",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: poolIdParam },
  responses: {
    200: jsonResponse("Field definitions", z.array(poolFieldDefinitionSchema)),
  },
});

const createFieldRoute = createRoute({
  method: "post",
  operationId: "createPoolField",
  path: "/{poolId}/fields",
  tags,
  summary: "Create pool field",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: poolIdParam, body: json(createFieldBody) },
  responses: {
    200: jsonResponse("Field definition", poolFieldDefinitionSchema),
    409: errorResponse("Name already used"),
  },
});

const queryRoute = createRoute({
  method: "post",
  operationId: "queryPoolMembers",
  path: "/{poolId}/query",
  tags,
  summary: "List and filter pool members",
  description:
    "Search plus an advanced filter on contact properties, this pool's fields and board stages. Newest activity first.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: poolIdParam, body: json(queryBody) },
  responses: {
    200: jsonResponse("Members", poolMemberListSchema),
    400: errorResponse("Invalid filter"),
  },
});

const upsertMemberRoute = createRoute({
  method: "put",
  operationId: "upsertPoolMember",
  path: "/{poolId}/members/{contactId}",
  tags,
  summary: "Add a contact to the pool and set field values",
  description:
    "Idempotent. Values are set by field name; null clears. With createMissing, unknown text/number/date/boolean fields are created.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolMemberParam, body: json(setMemberValuesBody) },
  responses: {
    200: jsonResponse("Member", poolMemberUpsertSchema),
    400: errorResponse("Invalid value or unknown field"),
    404: errorResponse("Contact not found"),
  },
});

const upsertByExternalRoute = createRoute({
  method: "put",
  operationId: "upsertPoolMemberByExternalId",
  path: "/{poolId}/external/{externalId}",
  tags,
  summary: "Add a contact (by external id) to the pool and set field values",
  description:
    "Same as upserting a member, finding the contact by its external id. The contact must exist.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolExternalParam, body: json(setMemberValuesBody) },
  responses: {
    200: jsonResponse("Member", poolMemberUpsertSchema),
    400: errorResponse("Invalid value or unknown field"),
    404: errorResponse("Contact not found"),
  },
});

const removeMemberRoute = createRoute({
  method: "delete",
  operationId: "removePoolMember",
  path: "/{poolId}/members/{contactId}",
  tags,
  summary: "Remove a contact from the pool",
  description:
    "Drops the membership and its field values; the contact is kept.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolMemberParam },
  responses: { 200: jsonResponse("Removed", successSchema) },
});

const bulkAddRoute = createRoute({
  method: "post",
  operationId: "bulkAddPoolMembers",
  path: "/{poolId}/bulk/add",
  tags,
  summary: "Add many contacts to the pool",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolIdParam, body: json(bulkIdsBody) },
  responses: { 200: jsonResponse("Added", bulkAddResponseSchema) },
});

const bulkRemoveRoute = createRoute({
  method: "post",
  operationId: "bulkRemovePoolMembers",
  path: "/{poolId}/bulk/remove",
  tags,
  summary: "Remove many contacts from the pool",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolIdParam, body: json(bulkIdsBody) },
  responses: { 200: jsonResponse("Removed", bulkRemoveResponseSchema) },
});

const bulkUpdateRoute = createRoute({
  method: "post",
  operationId: "bulkUpdatePoolMembers",
  path: "/{poolId}/bulk/update",
  tags,
  summary: "Set field values on many members",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolIdParam, body: json(bulkMemberValuesBody) },
  responses: {
    200: jsonResponse("Updated", bulkUpdateResponseSchema),
    400: errorResponse("Invalid value or unknown field"),
  },
});

const taskMembersRoute = createRoute({
  method: "get",
  operationId: "getTaskPoolMembers",
  path: "/task/{taskId}/members",
  tags,
  summary: "Pool members linked to a task",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Members", z.array(taskPoolMemberSchema)),
    404: errorResponse("Task not found"),
  },
});

const addToBoardRoute = createRoute({
  method: "post",
  operationId: "addPoolMembersToBoard",
  path: "/{poolId}/bulk/add-to-board",
  tags,
  summary: "Put members on a pipeline board",
  description:
    "Creates one task per member in the given stage (the board's first by default), linked to the member. Members already on that board are skipped.",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: poolIdParam, body: json(addToBoardBody) },
  responses: {
    200: jsonResponse("Added", addToBoardResponseSchema),
    400: errorResponse("Board or stage not found, or a required board field"),
    403: errorResponse("No access to the board"),
  },
});

const memberTasksRoute = createRoute({
  method: "get",
  operationId: "getPoolMemberTasks",
  path: "/{poolId}/members/{contactId}/tasks",
  tags,
  summary: "A member's pipeline tasks",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: poolMemberParam },
  responses: { 200: jsonResponse("Tasks", z.array(pipelineSchema)) },
});

const linkMemberTaskRoute = createRoute({
  method: "post",
  operationId: "linkPoolMemberTask",
  path: "/{poolId}/members/{contactId}/tasks",
  tags,
  summary: "Link a task to a member",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: poolMemberParam, body: json(linkTaskBody) },
  responses: {
    200: jsonResponse("Link", memberLinkResponseSchema),
    400: errorResponse("Different workspace"),
    404: errorResponse("Not a member"),
  },
});

const unlinkMemberTaskRoute = createRoute({
  method: "delete",
  operationId: "unlinkPoolMemberTask",
  path: "/{poolId}/members/{contactId}/tasks/{taskId}",
  tags,
  summary: "Unlink a task from a member",
  middleware: [
    contactAccess.fromPool(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: memberTaskParam },
  responses: { 200: jsonResponse("Unlinked", successSchema) },
});

const pool = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await svc.listPools(c.req.valid("param").workspaceId), 200),
  )
  .openapi(createPoolRoute, async (c) =>
    c.json(
      await svc.createPool(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(bySlugRoute, async (c) => {
    const { workspaceId, slug } = c.req.valid("param");
    return c.json(await svc.getPoolBySlug(workspaceId, slug), 200);
  })
  .openapi(taskMembersRoute, async (c) =>
    c.json(await pipelines.listTaskMembers(c.req.valid("param").taskId), 200),
  )
  .openapi(addToBoardRoute, async (c) =>
    c.json(
      await pipelines.addMembersToBoard(
        c.req.valid("param").poolId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(memberTasksRoute, async (c) => {
    const { poolId, contactId } = c.req.valid("param");
    return c.json(
      await pipelines.listMemberTasks(poolId, contactId, c.get("userId")),
      200,
    );
  })
  .openapi(linkMemberTaskRoute, async (c) => {
    const { poolId, contactId } = c.req.valid("param");
    return c.json(
      await pipelines.linkMemberTask(
        poolId,
        contactId,
        c.req.valid("json").taskId,
        c.get("userId"),
      ),
      200,
    );
  })
  .openapi(unlinkMemberTaskRoute, async (c) => {
    const { poolId, contactId, taskId } = c.req.valid("param");
    return c.json(
      await pipelines.unlinkMemberTask(
        poolId,
        contactId,
        taskId,
        c.get("userId"),
      ),
      200,
    );
  })
  .openapi(updateFieldRoute, async (c) =>
    c.json(
      await fields.updateField(
        c.req.valid("param").fieldId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteFieldRoute, async (c) =>
    c.json(await fields.deleteField(c.req.valid("param").fieldId), 200),
  )
  .openapi(getRoute, async (c) =>
    c.json(await svc.getPool(c.req.valid("param").poolId), 200),
  )
  .openapi(updateRoute, async (c) =>
    c.json(
      await svc.updatePool(c.req.valid("param").poolId, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await svc.deletePool(c.req.valid("param").poolId), 200),
  )
  .openapi(listFieldsRoute, async (c) =>
    c.json(await fields.listFields(c.req.valid("param").poolId), 200),
  )
  .openapi(createFieldRoute, async (c) =>
    c.json(
      await fields.createField(
        c.req.valid("param").poolId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(queryRoute, async (c) =>
    c.json(
      await svc.queryMembers(
        c.req.valid("param").poolId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(upsertMemberRoute, async (c) => {
    const { poolId, contactId } = c.req.valid("param");
    return c.json(
      await svc.upsertMember(poolId, contactId, c.req.valid("json")),
      200,
    );
  })
  .openapi(upsertByExternalRoute, async (c) => {
    const { poolId, externalId } = c.req.valid("param");
    return c.json(
      await svc.upsertMemberByExternalId(
        poolId,
        externalId,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(removeMemberRoute, async (c) => {
    const { poolId, contactId } = c.req.valid("param");
    return c.json(await svc.removeMember(poolId, contactId), 200);
  })
  .openapi(bulkAddRoute, async (c) =>
    c.json(
      await svc.bulkAddMembers(
        c.req.valid("param").poolId,
        c.req.valid("json").ids,
      ),
      200,
    ),
  )
  .openapi(bulkRemoveRoute, async (c) =>
    c.json(
      await svc.bulkRemoveMembers(
        c.req.valid("param").poolId,
        c.req.valid("json").ids,
      ),
      200,
    ),
  )
  .openapi(bulkUpdateRoute, async (c) =>
    c.json(
      await svc.bulkUpdateMembers(
        c.req.valid("param").poolId,
        c.req.valid("json"),
      ),
      200,
    ),
  );

export default pool;
