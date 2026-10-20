// Screening API (fork: svnix-solutions/kaneo). Mounted at /api/screening.
// Message steps are board settings (project:update to change); the context
// lookup is read-only (task:read) and is what the glue calls on a task move.
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { projectIdParam, replaceStepsBody, taskIdParam } from "./request";
import { messageStepSchema, screeningContextSchema } from "./response";
import * as svc from "./screening";

const tags = ["Screening"];

const listStepsRoute = createRoute({
  method: "get",
  operationId: "listMessageSteps",
  path: "/project/{projectId}/steps",
  tags,
  summary: "A board's message steps",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: { 200: jsonResponse("Steps", z.array(messageStepSchema)) },
});

const replaceStepsRoute = createRoute({
  method: "put",
  operationId: "replaceMessageSteps",
  path: "/project/{projectId}/steps",
  tags,
  summary: "Replace a board's message steps",
  description:
    "Each step starts a Typebot message flow, offsetDays after a contact's task leaves this board's backlog.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: replaceStepsBody } },
    },
  },
  responses: { 200: jsonResponse("Steps", z.array(messageStepSchema)) },
});

const contextRoute = createRoute({
  method: "get",
  operationId: "getScreeningContext",
  path: "/task/{taskId}",
  tags,
  summary: "Screening context of a task",
  description:
    "The task and its stage, the contacts linked to it, the pools screened on its board, and the board's enabled message steps.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Context", screeningContextSchema),
    404: errorResponse("Task not found"),
  },
});

const screening = apiRouter()
  .openapi(listStepsRoute, async (c) =>
    c.json(await svc.listSteps(c.req.valid("param").projectId), 200),
  )
  .openapi(replaceStepsRoute, async (c) =>
    c.json(
      await svc.replaceSteps(
        c.req.valid("param").projectId,
        c.req.valid("json").steps,
      ),
      200,
    ),
  )
  .openapi(contextRoute, async (c) =>
    c.json(await svc.screeningContext(c.req.valid("param").taskId), 200),
  );

export default screening;
