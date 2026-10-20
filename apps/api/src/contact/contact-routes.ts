// Contacts API (fork: svnix-solutions/kaneo). Mounted at /api/contact.
// Permissions reuse the task vocabulary: read = task:read, create =
// task:create, edit/link = task:update, delete = task:delete.
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
import * as svc from "./contacts";
import {
  bulkIdsBody,
  bulkUpdateContactsBody,
  contactIdParam,
  contactTaskParam,
  createContactBody,
  externalIdParam,
  linkTaskBody,
  listContactsQuery,
  queryBody,
  taskIdParam,
  updateContactBody,
  upsertContactBody,
  workspaceIdParam,
} from "./request";
import {
  bulkDeleteResponseSchema,
  bulkUpdateResponseSchema,
  contactListSchema,
  contactMembershipSchema,
  contactSchema,
  contactTaskSchema,
  contactUpsertSchema,
  linkResponseSchema,
  successSchema,
} from "./response";

const tags = ["Contacts"];
const json = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listContacts",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List contacts",
  description:
    "List and search contacts in a workspace, newest activity first.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, query: listContactsQuery },
  responses: {
    200: jsonResponse("Contacts", contactListSchema),
    403: errorResponse("No access"),
  },
});

const queryRoute = createRoute({
  method: "post",
  operationId: "queryContacts",
  path: "/workspace/{workspaceId}/query",
  tags,
  summary: "Filter contacts",
  description:
    "Search plus an advanced filter on contact properties, pool membership and board stages, joined by all/any.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(queryBody) },
  responses: {
    200: jsonResponse("Contacts", contactListSchema),
    400: errorResponse("Invalid filter"),
  },
});

const createContactRoute = createRoute({
  method: "post",
  operationId: "createContact",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Create contact",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(createContactBody) },
  responses: {
    200: jsonResponse("Created contact", contactUpsertSchema),
    409: errorResponse("externalId already used"),
  },
});

const getByExternalRoute = createRoute({
  method: "get",
  operationId: "getContactByExternalId",
  path: "/workspace/{workspaceId}/external/{externalId}",
  tags,
  summary: "Get contact by external id",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: externalIdParam },
  responses: {
    200: jsonResponse("Contact", contactSchema),
    404: errorResponse("Contact not found"),
  },
});

const upsertByExternalRoute = createRoute({
  method: "put",
  operationId: "upsertContactByExternalId",
  path: "/workspace/{workspaceId}/external/{externalId}",
  tags,
  summary: "Create or update contact by external id",
  description:
    "Idempotent: creates the contact if no contact has this externalId (name required), otherwise updates the given properties.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: { params: externalIdParam, body: json(upsertContactBody) },
  responses: {
    200: jsonResponse("Contact", contactUpsertSchema),
    400: errorResponse("Invalid input"),
  },
});

const bulkUpdateRoute = createRoute({
  method: "post",
  operationId: "bulkUpdateContacts",
  path: "/workspace/{workspaceId}/bulk/update",
  tags,
  summary: "Set the source of many contacts",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(bulkUpdateContactsBody) },
  responses: { 200: jsonResponse("Updated", bulkUpdateResponseSchema) },
});

const bulkDeleteRoute = createRoute({
  method: "post",
  operationId: "bulkDeleteContacts",
  path: "/workspace/{workspaceId}/bulk/delete",
  tags,
  summary: "Delete many contacts",
  description:
    "Deletes the listed contacts in the workspace with their pool memberships and task links (tasks are kept).",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["delete"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(bulkIdsBody) },
  responses: { 200: jsonResponse("Deleted", bulkDeleteResponseSchema) },
});

const taskContactsRoute = createRoute({
  method: "get",
  operationId: "getTaskContacts",
  path: "/task/{taskId}",
  tags,
  summary: "Contacts linked to a task",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Contacts", z.array(contactSchema)),
    404: errorResponse("Task not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getContact",
  path: "/{id}",
  tags,
  summary: "Get contact",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: contactIdParam },
  responses: {
    200: jsonResponse("Contact", contactSchema),
    404: errorResponse("Contact not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateContact",
  path: "/{id}",
  tags,
  summary: "Update contact",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: contactIdParam, body: json(updateContactBody) },
  responses: {
    200: jsonResponse("Contact", contactSchema),
    409: errorResponse("externalId already used"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteContact",
  path: "/{id}",
  tags,
  summary: "Delete contact",
  description:
    "Deletes the contact, its pool memberships and its task links (tasks are kept).",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["delete"] }),
  ] as const,
  request: { params: contactIdParam },
  responses: { 200: jsonResponse("Deleted", successSchema) },
});

const membershipsRoute = createRoute({
  method: "get",
  operationId: "getContactPools",
  path: "/{id}/pools",
  tags,
  summary: "Pools a contact is in",
  description: "Each membership with that pool's field values.",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: contactIdParam },
  responses: {
    200: jsonResponse("Memberships", z.array(contactMembershipSchema)),
  },
});

const listTasksRoute = createRoute({
  method: "get",
  operationId: "getContactTasks",
  path: "/{id}/tasks",
  tags,
  summary: "Tasks linked to a contact",
  description: "Across every project the caller can access.",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: contactIdParam },
  responses: { 200: jsonResponse("Tasks", z.array(contactTaskSchema)) },
});

const linkRoute = createRoute({
  method: "post",
  operationId: "linkContactTask",
  path: "/{id}/tasks",
  tags,
  summary: "Link a task",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: contactIdParam, body: json(linkTaskBody) },
  responses: {
    200: jsonResponse("Link", linkResponseSchema),
    400: errorResponse("Different workspace"),
    403: errorResponse("No access to the task's project"),
  },
});

const unlinkRoute = createRoute({
  method: "delete",
  operationId: "unlinkContactTask",
  path: "/{id}/tasks/{taskId}",
  tags,
  summary: "Unlink a task",
  middleware: [
    contactAccess.fromContact(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: contactTaskParam },
  responses: { 200: jsonResponse("Unlinked", successSchema) },
});

const contact = apiRouter()
  .openapi(listRoute, async (c) => {
    const { q, limit, offset } = c.req.valid("query");
    return c.json(
      await svc.listContacts(
        c.req.valid("param").workspaceId,
        q,
        limit,
        offset,
      ),
      200,
    );
  })
  .openapi(queryRoute, async (c) =>
    c.json(
      await svc.queryContacts(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(createContactRoute, async (c) =>
    c.json(
      await svc.createContact(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(getByExternalRoute, async (c) => {
    const { workspaceId, externalId } = c.req.valid("param");
    return c.json(
      await svc.getContactByExternalId(workspaceId, externalId),
      200,
    );
  })
  .openapi(upsertByExternalRoute, async (c) => {
    const { workspaceId, externalId } = c.req.valid("param");
    return c.json(
      await svc.upsertContactByExternalId(
        workspaceId,
        externalId,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(bulkUpdateRoute, async (c) =>
    c.json(
      await svc.bulkUpdateContacts(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(bulkDeleteRoute, async (c) =>
    c.json(
      await svc.bulkDeleteContacts(
        c.req.valid("param").workspaceId,
        c.req.valid("json").ids,
      ),
      200,
    ),
  )
  .openapi(taskContactsRoute, async (c) =>
    c.json(await svc.listTaskContacts(c.req.valid("param").taskId), 200),
  )
  .openapi(getRoute, async (c) =>
    c.json(await svc.getContact(c.req.valid("param").id), 200),
  )
  .openapi(updateRoute, async (c) =>
    c.json(
      await svc.updateContact(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await svc.deleteContact(c.req.valid("param").id), 200),
  )
  .openapi(membershipsRoute, async (c) =>
    c.json(await svc.listContactMemberships(c.req.valid("param").id), 200),
  )
  .openapi(listTasksRoute, async (c) =>
    c.json(
      await svc.listContactTasks(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  )
  .openapi(linkRoute, async (c) =>
    c.json(
      await svc.linkTask(
        c.req.valid("param").id,
        c.req.valid("json").taskId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(unlinkRoute, async (c) => {
    const { id, taskId } = c.req.valid("param");
    return c.json(await svc.unlinkTask(id, taskId, c.get("userId")), 200);
  });

export default contact;
