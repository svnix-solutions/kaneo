// Where a contact stands with each pool: targeted and/or a member, and the
// stage of their task on the pool's screening board (fork: svnix-solutions/kaneo).
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import db from "../database";
import { columnTable, taskTable } from "../database/schema";
import type { DbLike } from "./fields";
import {
  contactTargetPoolTable,
  poolMemberTable,
  poolTable,
  taskContactTable,
} from "./schema";

export type PoolStateKind =
  | "not_queued" // targeted, nothing on the screening board yet
  | "backlog" // queued in the screening board's backlog
  | "in_progress" // on the screening board, not in a final stage
  | "final" // in a final stage of the screening board
  | "member"; // in the pool, no screening task

export type PoolState = {
  id: string;
  name: string;
  slug: string;
  target: boolean;
  member: boolean;
  stage: string | null;
  state: PoolStateKind;
};

export async function poolStatesFor(
  contactIds: string[],
  conn: DbLike = db,
  onlyPoolId?: string,
) {
  const map = new Map<string, PoolState[]>();
  if (contactIds.length === 0) return map;
  const poolFilter = (
    col: typeof poolMemberTable.poolId | typeof contactTargetPoolTable.poolId,
  ) => (onlyPoolId ? eq(col, onlyPoolId) : undefined);

  const [targets, members] = await Promise.all([
    conn
      .select({
        contactId: contactTargetPoolTable.contactId,
        poolId: contactTargetPoolTable.poolId,
      })
      .from(contactTargetPoolTable)
      .where(
        and(
          inArray(contactTargetPoolTable.contactId, contactIds),
          poolFilter(contactTargetPoolTable.poolId),
        ),
      ),
    conn
      .select({
        contactId: poolMemberTable.contactId,
        poolId: poolMemberTable.poolId,
      })
      .from(poolMemberTable)
      .where(
        and(
          inArray(poolMemberTable.contactId, contactIds),
          poolFilter(poolMemberTable.poolId),
        ),
      ),
  ]);
  const poolIds = [...new Set([...targets, ...members].map((r) => r.poolId))];
  if (poolIds.length === 0) return map;

  const pools = await conn
    .select()
    .from(poolTable)
    .where(inArray(poolTable.id, poolIds))
    .orderBy(asc(poolTable.position), asc(poolTable.name));
  const boards = [
    ...new Set(pools.map((p) => p.screeningProjectId).filter(Boolean)),
  ] as string[];

  // The newest task per (contact, screening board).
  const tasks = boards.length
    ? await conn
        .select({
          contactId: taskContactTable.contactId,
          projectId: taskTable.projectId,
          status: taskTable.status,
          columnName: columnTable.name,
          isFinal: columnTable.isFinal,
        })
        .from(taskContactTable)
        .innerJoin(taskTable, eq(taskTable.id, taskContactTable.taskId))
        .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
        .where(
          and(
            inArray(taskContactTable.contactId, contactIds),
            inArray(taskTable.projectId, boards),
            isNotNull(taskTable.projectId),
          ),
        )
        .orderBy(desc(taskTable.createdAt))
    : [];
  const taskOf = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) {
    const key = `${t.contactId}:${t.projectId}`;
    if (!taskOf.has(key)) taskOf.set(key, t);
  }

  const has = (rows: typeof targets) =>
    new Set(rows.map((r) => `${r.contactId}:${r.poolId}`));
  const targeted = has(targets);
  const joined = has(members);

  for (const contactId of contactIds) {
    const states: PoolState[] = [];
    for (const pool of pools) {
      const target = targeted.has(`${contactId}:${pool.id}`);
      const member = joined.has(`${contactId}:${pool.id}`);
      if (!target && !member) continue;
      const task = pool.screeningProjectId
        ? taskOf.get(`${contactId}:${pool.screeningProjectId}`)
        : undefined;
      let state: PoolStateKind;
      let stage: string | null = null;
      if (task?.status === "planned") {
        state = "backlog";
      } else if (task && task.status !== "archived") {
        state = task.isFinal ? "final" : "in_progress";
        stage = task.columnName ?? null;
      } else {
        state = member ? "member" : "not_queued";
      }
      states.push({
        id: pool.id,
        name: pool.name,
        slug: pool.slug,
        target,
        member,
        stage,
        state,
      });
    }
    if (states.length) map.set(contactId, states);
  }
  return map;
}
