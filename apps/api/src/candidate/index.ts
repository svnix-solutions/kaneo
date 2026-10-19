// Candidates API (fork: svnix-solutions/kaneo). Mounted at /api/candidate.
// Permissions reuse the task vocabulary: read = task:read, create = task:create,
// edit/link = task:update, delete = task:delete; field definitions need
// workspace:manage_settings (values with createMissing only need task:update).
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { candidateAccess } from "./candidate-access";
import {
  candidateIdParam,
  candidateTaskParam,
  createCandidateBody,
  createFieldBody,
  externalIdParam,
  fieldIdParam,
  linkTaskBody,
  listCandidatesQuery,
  setCandidateValuesBody,
  taskIdParam,
  updateCandidateBody,
  updateFieldBody,
  upsertCandidateBody,
  workspaceIdParam,
} from "./request";
import {
  candidateFieldDefinitionSchema,
  candidateListSchema,
  candidateSchema,
  candidateTaskSchema,
  candidateUpsertSchema,
  linkResponseSchema,
  setValuesResponseSchema,
  successSchema,
} from "./response";
import * as svc from "./service";
import { z } from "../openapi";

const tags = ["Candidates"];
const json = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listCandidates",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List candidates",
  description:
    "List and search candidates in a workspace, newest activity first.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, query: listCandidatesQuery },
  responses: {
    200: jsonResponse("Candidates", candidateListSchema),
    403: errorResponse("No access"),
  },
});

const createCandidateRoute = createRoute({
  method: "post",
  operationId: "createCandidate",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Create candidate",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(createCandidateBody) },
  responses: {
    200: jsonResponse("Created candidate", candidateUpsertSchema),
    400: errorResponse("Invalid input"),
    409: errorResponse("externalId already used"),
  },
});

const getByExternalRoute = createRoute({
  method: "get",
  operationId: "getCandidateByExternalId",
  path: "/workspace/{workspaceId}/external/{externalId}",
  tags,
  summary: "Get candidate by external id",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: externalIdParam },
  responses: {
    200: jsonResponse("Candidate", candidateSchema),
    404: errorResponse("Candidate not found"),
  },
});

const upsertByExternalRoute = createRoute({
  method: "put",
  operationId: "upsertCandidateByExternalId",
  path: "/workspace/{workspaceId}/external/{externalId}",
  tags,
  summary: "Create or update candidate by external id",
  description:
    "Idempotent: creates the candidate if no candidate has this externalId (name required), otherwise updates the given core fields and values.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: { params: externalIdParam, body: json(upsertCandidateBody) },
  responses: {
    200: jsonResponse("Candidate", candidateUpsertSchema),
    400: errorResponse("Invalid input"),
  },
});

const listFieldsRoute = createRoute({
  method: "get",
  operationId: "listCandidateFields",
  path: "/workspace/{workspaceId}/fields",
  tags,
  summary: "List candidate fields",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "Field definitions",
      z.array(candidateFieldDefinitionSchema),
    ),
  },
});

const createFieldRoute = createRoute({
  method: "post",
  operationId: "createCandidateField",
  path: "/workspace/{workspaceId}/fields",
  tags,
  summary: "Create candidate field",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: workspaceIdParam, body: json(createFieldBody) },
  responses: {
    200: jsonResponse("Field definition", candidateFieldDefinitionSchema),
    409: errorResponse("Name already used"),
  },
});

const updateFieldRoute = createRoute({
  method: "put",
  operationId: "updateCandidateField",
  path: "/fields/{fieldId}",
  tags,
  summary: "Update candidate field",
  middleware: [
    candidateAccess.fromField("fieldId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: fieldIdParam, body: json(updateFieldBody) },
  responses: {
    200: jsonResponse("Field definition", candidateFieldDefinitionSchema),
    404: errorResponse("Not found"),
  },
});

const deleteFieldRoute = createRoute({
  method: "delete",
  operationId: "deleteCandidateField",
  path: "/fields/{fieldId}",
  tags,
  summary: "Delete candidate field",
  description: "Deletes the field and its value on every candidate.",
  middleware: [
    candidateAccess.fromField("fieldId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: fieldIdParam },
  responses: {
    200: jsonResponse("Deleted", successSchema),
    404: errorResponse("Not found"),
  },
});

const taskCandidatesRoute = createRoute({
  method: "get",
  operationId: "getTaskCandidates",
  path: "/task/{taskId}",
  tags,
  summary: "Candidates linked to a task",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Candidates", z.array(candidateSchema)),
    404: errorResponse("Task not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getCandidate",
  path: "/{id}",
  tags,
  summary: "Get candidate",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: candidateIdParam },
  responses: {
    200: jsonResponse("Candidate", candidateSchema),
    404: errorResponse("Candidate not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateCandidate",
  path: "/{id}",
  tags,
  summary: "Update candidate",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: candidateIdParam, body: json(updateCandidateBody) },
  responses: {
    200: jsonResponse("Candidate", candidateSchema),
    409: errorResponse("externalId already used"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteCandidate",
  path: "/{id}",
  tags,
  summary: "Delete candidate",
  description:
    "Deletes the candidate, its field values and its task links (tasks are kept).",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["delete"] }),
  ] as const,
  request: { params: candidateIdParam },
  responses: { 200: jsonResponse("Deleted", successSchema) },
});

const setValuesRoute = createRoute({
  method: "put",
  operationId: "setCandidateValues",
  path: "/{id}/values",
  tags,
  summary: "Set candidate field values",
  description:
    "Upsert values by field name; null clears. With createMissing, unknown text/number/date/boolean fields are created.",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: candidateIdParam, body: json(setCandidateValuesBody) },
  responses: {
    200: jsonResponse("Values", setValuesResponseSchema),
    400: errorResponse("Invalid value or unknown field"),
  },
});

const listTasksRoute = createRoute({
  method: "get",
  operationId: "getCandidateTasks",
  path: "/{id}/tasks",
  tags,
  summary: "Tasks linked to a candidate",
  description: "Across every project the caller can access.",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: candidateIdParam },
  responses: { 200: jsonResponse("Tasks", z.array(candidateTaskSchema)) },
});

const linkRoute = createRoute({
  method: "post",
  operationId: "linkCandidateTask",
  path: "/{id}/tasks",
  tags,
  summary: "Link a task",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: candidateIdParam, body: json(linkTaskBody) },
  responses: {
    200: jsonResponse("Link", linkResponseSchema),
    400: errorResponse("Different workspace"),
    403: errorResponse("No access to the task's project"),
  },
});

const unlinkRoute = createRoute({
  method: "delete",
  operationId: "unlinkCandidateTask",
  path: "/{id}/tasks/{taskId}",
  tags,
  summary: "Unlink a task",
  middleware: [
    candidateAccess.fromCandidate(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: candidateTaskParam },
  responses: { 200: jsonResponse("Unlinked", successSchema) },
});

const candidate = apiRouter()
  .openapi(listRoute, async (c) => {
    const { q, limit, offset } = c.req.valid("query");
    return c.json(
      await svc.listCandidates(
        c.req.valid("param").workspaceId,
        q,
        limit,
        offset,
      ),
      200,
    );
  })
  .openapi(createCandidateRoute, async (c) =>
    c.json(
      await svc.createCandidate(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(getByExternalRoute, async (c) => {
    const { workspaceId, externalId } = c.req.valid("param");
    return c.json(
      await svc.getCandidateByExternalId(workspaceId, externalId),
      200,
    );
  })
  .openapi(upsertByExternalRoute, async (c) => {
    const { workspaceId, externalId } = c.req.valid("param");
    return c.json(
      await svc.upsertCandidateByExternalId(
        workspaceId,
        externalId,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(listFieldsRoute, async (c) =>
    c.json(await svc.listFields(c.req.valid("param").workspaceId), 200),
  )
  .openapi(createFieldRoute, async (c) =>
    c.json(
      await svc.createField(
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(updateFieldRoute, async (c) =>
    c.json(
      await svc.updateField(c.req.valid("param").fieldId, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteFieldRoute, async (c) =>
    c.json(await svc.deleteField(c.req.valid("param").fieldId), 200),
  )
  .openapi(taskCandidatesRoute, async (c) =>
    c.json(await svc.listTaskCandidates(c.req.valid("param").taskId), 200),
  )
  .openapi(getRoute, async (c) =>
    c.json(await svc.getCandidate(c.req.valid("param").id), 200),
  )
  .openapi(updateRoute, async (c) =>
    c.json(
      await svc.updateCandidate(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await svc.deleteCandidate(c.req.valid("param").id), 200),
  )
  .openapi(setValuesRoute, async (c) =>
    c.json(
      await svc.setCandidateValues(
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(listTasksRoute, async (c) =>
    c.json(
      await svc.listCandidateTasks(c.req.valid("param").id, c.get("userId")),
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

export default candidate;
