// Screening (fork: svnix-solutions/kaneo): a pool names a screening board;
// contacts queue in that board's backlog. When a recruiter moves a contact's
// task onto the board, the glue (told by the board's generic webhook) starts
// the board's message steps -- Typebot "message flows" -- and later flow
// events update that same task.
import { and, asc, eq, inArray } from "drizzle-orm";
import db from "../database";
import { columnTable, projectTable, taskTable } from "../database/schema";
import { assertProjectAccess } from "../project-access/assert-project-access";
import createTask from "../task/controllers/create-task";
import { serializeContactCore } from "./contacts";
import { badRequest, notFound } from "./fields";
import {
  contactTable,
  poolTable,
  projectMessageStepTable as stepTable,
  taskContactTable,
} from "./schema";

/**
 * Queue contacts for a pool's screening: one backlog task each on the pool's
 * screening board (with the contact's priority), linked to the contact.
 * Contacts already with a task on that board are skipped.
 */
export async function addToScreening(
  poolId: string,
  userId: string,
  ids: string[],
) {
  const [pool] = await db
    .select()
    .from(poolTable)
    .where(eq(poolTable.id, poolId))
    .limit(1);
  if (!pool) notFound("Pool not found");
  const {
    screeningProjectId: projectId,
    workspaceId,
    name,
  } = pool as NonNullable<typeof pool>;
  if (!projectId) badRequest(`${name} has no screening board`);
  const boardId = projectId as string;
  await assertProjectAccess(userId, boardId);

  const contacts = await db
    .select()
    .from(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        inArray(contactTable.id, [...new Set(ids)]),
      ),
    );
  if (contacts.length === 0) return { added: 0, skipped: 0, taskIds: [] };

  const queued = new Set(
    (
      await db
        .select({ contactId: taskContactTable.contactId })
        .from(taskContactTable)
        .innerJoin(taskTable, eq(taskTable.id, taskContactTable.taskId))
        .where(
          and(
            eq(taskTable.projectId, boardId),
            inArray(
              taskContactTable.contactId,
              contacts.map((c) => c.id),
            ),
          ),
        )
    ).map((r) => r.contactId),
  );

  const taskIds: string[] = [];
  for (const contact of contacts) {
    if (queued.has(contact.id)) continue;
    const task = await createTask({
      projectId: boardId,
      currentUserId: userId,
      title: contact.name,
      status: "planned",
      priority: contact.priority,
      description: `**Screening for:** ${name}`,
    });
    await db
      .insert(taskContactTable)
      .values({ taskId: task.id, contactId: contact.id, createdBy: userId })
      .onConflictDoNothing();
    taskIds.push(task.id);
  }
  return {
    added: taskIds.length,
    skipped: contacts.length - taskIds.length,
    taskIds,
  };
}

// ---- message steps ---------------------------------------------------------------

function serializeStep(s: typeof stepTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    typebotPublicId: s.typebotPublicId,
    offsetDays: s.offsetDays,
    position: s.position,
    enabled: s.enabled,
  };
}

export async function listSteps(projectId: string) {
  const rows = await db
    .select()
    .from(stepTable)
    .where(eq(stepTable.projectId, projectId))
    .orderBy(asc(stepTable.position), asc(stepTable.offsetDays));
  return rows.map(serializeStep);
}

/** Replace a board's message steps, in the given order. */
export async function replaceSteps(
  projectId: string,
  steps: {
    name: string;
    typebotPublicId: string;
    offsetDays: number;
    enabled?: boolean;
  }[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(stepTable).where(eq(stepTable.projectId, projectId));
    if (steps.length) {
      await tx.insert(stepTable).values(
        steps.map((step, position) => ({
          projectId,
          name: step.name.trim(),
          typebotPublicId: step.typebotPublicId.trim(),
          offsetDays: step.offsetDays,
          enabled: step.enabled ?? true,
          position,
        })),
      );
    }
  });
  return listSteps(projectId);
}

/**
 * Everything the glue needs when a task moves: the task and its stage, the
 * contacts linked to it, the pools screened on this board, and the steps.
 */
export async function screeningContext(taskId: string) {
  const [row] = await db
    .select({
      task: taskTable,
      projectSlug: projectTable.slug,
      projectName: projectTable.name,
      workspaceId: projectTable.workspaceId,
      columnName: columnTable.name,
      isFinal: columnTable.isFinal,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!row) notFound("Task not found");
  const r = row as NonNullable<typeof row>;
  const [contacts, pools, steps] = await Promise.all([
    db
      .select({ contact: contactTable })
      .from(taskContactTable)
      .innerJoin(contactTable, eq(contactTable.id, taskContactTable.contactId))
      .where(
        and(
          eq(taskContactTable.taskId, taskId),
          eq(contactTable.workspaceId, r.workspaceId),
        ),
      )
      .orderBy(asc(taskContactTable.createdAt)),
    db
      .select({ id: poolTable.id, name: poolTable.name, slug: poolTable.slug })
      .from(poolTable)
      .where(eq(poolTable.screeningProjectId, r.task.projectId)),
    listSteps(r.task.projectId),
  ]);
  return {
    task: {
      id: r.task.id,
      number: r.task.number,
      title: r.task.title,
      status: r.task.status,
      priority: r.task.priority,
      projectId: r.task.projectId,
      projectSlug: r.projectSlug,
      projectName: r.projectName,
      columnName: r.columnName,
      isFinal: !!r.isFinal,
      inBacklog: r.task.status === "planned",
    },
    contacts: contacts.map((c) => ({
      ...serializeContactCore(c.contact),
    })),
    pools,
    steps: steps.filter((s) => s.enabled),
  };
}
