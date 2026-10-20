// Pipelines: pool members on boards (e.g. "Max Home Care: nurses" with
// Interview -> Selection -> Hired). A pipeline task links to the pool member,
// not the bare contact: the person is shortlisted as a member of the pool.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import db from "../database";
import { columnTable, projectTable, taskTable } from "../database/schema";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { projectAccessCondition } from "../project-access/project-access-condition";
import createTask from "../task/controllers/create-task";
import { serializeContactCore } from "./contacts";
import { badRequest, notFound } from "./fields";
import {
  contactTable,
  poolMemberTable,
  poolTable,
  taskPoolMemberTable,
} from "./schema";

// Local lookup: pools.ts imports this module for its member rows.
async function findPool(id: string) {
  const [row] = await db
    .select()
    .from(poolTable)
    .where(eq(poolTable.id, id))
    .limit(1);
  return row ?? notFound("Pool not found");
}

const pipelineColumns = {
  memberId: taskPoolMemberTable.memberId,
  taskId: taskTable.id,
  number: taskTable.number,
  title: taskTable.title,
  projectId: projectTable.id,
  projectName: projectTable.name,
  columnName: columnTable.name,
  isFinal: columnTable.isFinal,
  linkedAt: taskPoolMemberTable.createdAt,
};

type PipelineRow = {
  memberId: string;
  taskId: string;
  number: number | null;
  title: string;
  projectId: string;
  projectName: string;
  columnName: string | null;
  isFinal: boolean | null;
  linkedAt: Date;
};

const serializePipeline = ({ memberId: _m, ...r }: PipelineRow) => ({
  ...r,
  isFinal: !!r.isFinal,
  linkedAt: r.linkedAt.toISOString(),
});

/** Pipeline tasks by member id, on boards this user can see, newest first. */
export async function pipelinesFor(memberIds: string[], userId: string) {
  const map = new Map<string, ReturnType<typeof serializePipeline>[]>();
  if (memberIds.length === 0) return map;
  const rows = await db
    .select(pipelineColumns)
    .from(taskPoolMemberTable)
    .innerJoin(taskTable, eq(taskTable.id, taskPoolMemberTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
    .where(
      and(
        inArray(taskPoolMemberTable.memberId, memberIds),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(desc(taskPoolMemberTable.createdAt));
  for (const row of rows) {
    map.set(row.memberId, [
      ...(map.get(row.memberId) ?? []),
      serializePipeline(row),
    ]);
  }
  return map;
}

async function findMember(poolId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(poolMemberTable)
    .where(
      and(
        eq(poolMemberTable.poolId, poolId),
        eq(poolMemberTable.contactId, contactId),
      ),
    )
    .limit(1);
  return row ?? notFound("Not a member of this pool");
}

export async function listMemberTasks(
  poolId: string,
  contactId: string,
  userId: string,
) {
  const member = await findMember(poolId, contactId);
  return (await pipelinesFor([member.id], userId)).get(member.id) ?? [];
}

/** A board in the pool's workspace that the user can reach, and its stage. */
async function boardAndStage(
  workspaceId: string,
  userId: string,
  projectId: string,
  columnId: string | undefined,
) {
  const [project] = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      workspaceId: projectTable.workspaceId,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  if (!project || project.workspaceId !== workspaceId)
    badRequest("Board not found in this workspace");
  await assertProjectAccess(userId, projectId);
  const columns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));
  const column = columnId ? columns.find((c) => c.id === columnId) : columns[0];
  if (!column) badRequest("Stage not found on this board");
  return {
    project: project as NonNullable<typeof project>,
    column: column as NonNullable<typeof column>,
  };
}

/**
 * Put members on a board: one task per member in the given stage (the first
 * one by default), linked to the member. Members already on that board are
 * skipped, so it is safe to repeat.
 */
export async function addMembersToBoard(
  poolId: string,
  userId: string,
  body: { ids: string[]; projectId: string; columnId?: string },
) {
  const pool = await findPool(poolId);
  const { project, column } = await boardAndStage(
    pool.workspaceId,
    userId,
    body.projectId,
    body.columnId,
  );
  const members = await db
    .select({ member: poolMemberTable, contact: contactTable })
    .from(poolMemberTable)
    .innerJoin(contactTable, eq(contactTable.id, poolMemberTable.contactId))
    .where(
      and(
        eq(poolMemberTable.poolId, poolId),
        inArray(poolMemberTable.contactId, [...new Set(body.ids)]),
      ),
    );
  if (members.length === 0) return { added: 0, skipped: 0, taskIds: [] };

  const onBoard = new Set(
    (
      await db
        .select({ memberId: taskPoolMemberTable.memberId })
        .from(taskPoolMemberTable)
        .innerJoin(taskTable, eq(taskTable.id, taskPoolMemberTable.taskId))
        .where(
          and(
            eq(taskTable.projectId, project.id),
            inArray(
              taskPoolMemberTable.memberId,
              members.map((m) => m.member.id),
            ),
          ),
        )
    ).map((r) => r.memberId),
  );

  const taskIds: string[] = [];
  for (const { member, contact } of members) {
    if (onBoard.has(member.id)) continue;
    // The same path as a task created on the board: numbering, position,
    // required board fields and the task.created event.
    const task = await createTask({
      projectId: project.id,
      currentUserId: userId,
      title: contact.name,
      status: column.slug,
      description: `**Pool:** ${pool.name}`,
    });
    await db
      .insert(taskPoolMemberTable)
      .values({ taskId: task.id, memberId: member.id, createdBy: userId })
      .onConflictDoNothing();
    taskIds.push(task.id);
  }
  return {
    added: taskIds.length,
    skipped: members.length - taskIds.length,
    taskIds,
  };
}

async function taskScope(taskId: string) {
  const [row] = await db
    .select({
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  return row ?? notFound("Task not found");
}

export async function linkMemberTask(
  poolId: string,
  contactId: string,
  taskId: string,
  userId: string,
) {
  const pool = await findPool(poolId);
  const member = await findMember(poolId, contactId);
  const scope = await taskScope(taskId);
  if (scope.workspaceId !== pool.workspaceId)
    badRequest("Task and pool are in different workspaces");
  await assertProjectAccess(userId, scope.projectId);
  const [row] = await db
    .insert(taskPoolMemberTable)
    .values({ taskId, memberId: member.id, createdBy: userId })
    .onConflictDoNothing()
    .returning({ id: taskPoolMemberTable.id });
  return { taskId, memberId: member.id, created: !!row };
}

export async function unlinkMemberTask(
  poolId: string,
  contactId: string,
  taskId: string,
  userId: string,
) {
  const member = await findMember(poolId, contactId);
  const scope = await taskScope(taskId);
  await assertProjectAccess(userId, scope.projectId);
  await db
    .delete(taskPoolMemberTable)
    .where(
      and(
        eq(taskPoolMemberTable.memberId, member.id),
        eq(taskPoolMemberTable.taskId, taskId),
      ),
    );
  return { success: true };
}

/** Pool members linked to a task, for the task page. */
export async function listTaskMembers(taskId: string) {
  const rows = await db
    .select({
      contact: contactTable,
      memberId: poolMemberTable.id,
      poolId: poolTable.id,
      poolName: poolTable.name,
      poolSlug: poolTable.slug,
    })
    .from(taskPoolMemberTable)
    .innerJoin(
      poolMemberTable,
      eq(poolMemberTable.id, taskPoolMemberTable.memberId),
    )
    .innerJoin(poolTable, eq(poolTable.id, poolMemberTable.poolId))
    .innerJoin(contactTable, eq(contactTable.id, poolMemberTable.contactId))
    .innerJoin(taskTable, eq(taskTable.id, taskPoolMemberTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskPoolMemberTable.taskId, taskId),
        eq(projectTable.workspaceId, poolTable.workspaceId),
      ),
    )
    .orderBy(asc(taskPoolMemberTable.createdAt));
  return rows.map((r) => ({
    ...serializeContactCore(r.contact),
    memberId: r.memberId,
    pool: { id: r.poolId, name: r.poolName, slug: r.poolSlug },
  }));
}
