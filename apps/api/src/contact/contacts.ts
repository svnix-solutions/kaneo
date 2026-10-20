// Contacts: one record per person, keyed by the source system's id.
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, projectTable, taskTable } from "../database/schema";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { escapeLikePattern } from "../search/like-pattern";
import {
  type DbLike,
  isUniqueViolation,
  notFound,
  badRequest,
  valuesFor,
} from "./fields";
import { buildContactFilter, type ContactFilter } from "./filter";
import {
  contactTable,
  poolMemberTable,
  contactTargetPoolTable,
  poolTable,
  taskContactTable,
} from "./schema";

export type Contact = typeof contactTable.$inferSelect;
type PoolRef = { id: string; name: string; slug: string };

// Pools by contact, through a contact -> pool link table (memberships or targets).
async function linkedPools(
  link: typeof poolMemberTable | typeof contactTargetPoolTable,
  contactIds: string[],
  conn: DbLike = db,
) {
  const map = new Map<string, PoolRef[]>();
  if (contactIds.length === 0) return map;
  const rows = await conn
    .select({
      contactId: link.contactId,
      id: poolTable.id,
      name: poolTable.name,
      slug: poolTable.slug,
    })
    .from(link)
    .innerJoin(poolTable, eq(poolTable.id, link.poolId))
    .where(inArray(link.contactId, contactIds))
    .orderBy(asc(poolTable.position), asc(poolTable.name));
  for (const { contactId, ...pool } of rows) {
    map.set(contactId, [...(map.get(contactId) ?? []), pool]);
  }
  return map;
}

export function serializeContactCore(c: Contact) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    externalId: c.externalId,
    source: c.source,
    priority: c.priority,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function serializeContacts(rows: Contact[], conn: DbLike = db) {
  const ids = rows.map((r) => r.id);
  const [pools, targets] = await Promise.all([
    linkedPools(poolMemberTable, ids, conn),
    linkedPools(contactTargetPoolTable, ids, conn),
  ]);
  return rows.map((r) => ({
    ...serializeContactCore(r),
    pools: pools.get(r.id) ?? [],
    targetPools: targets.get(r.id) ?? [],
  }));
}

async function serializeContact(c: Contact, conn: DbLike = db) {
  return (await serializeContacts([c], conn))[0] as Awaited<
    ReturnType<typeof serializeContacts>
  >[number];
}

/** Workspace plus optional search over name, phone, email and external id. */
export function contactSearch(workspaceId: string, q: string | undefined) {
  const term = q?.trim();
  const inWorkspace = eq(contactTable.workspaceId, workspaceId);
  if (!term) return inWorkspace;
  const like = `%${escapeLikePattern(term)}%`;
  return and(
    inWorkspace,
    or(
      ilike(contactTable.name, like),
      ilike(contactTable.phone, like),
      ilike(contactTable.email, like),
      ilike(contactTable.externalId, like),
    ),
  );
}

async function pageOfContacts(
  where: SQL | undefined,
  limit: number,
  offset: number,
) {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(contactTable)
      .where(where)
      .orderBy(desc(contactTable.updatedAt), asc(contactTable.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(contactTable).where(where),
  ]);
  return { items: await serializeContacts(rows), total: totalRow?.total ?? 0 };
}

export function listContacts(
  workspaceId: string,
  q: string | undefined,
  limit: number,
  offset: number,
) {
  return pageOfContacts(contactSearch(workspaceId, q), limit, offset);
}

export async function queryContacts(
  workspaceId: string,
  userId: string,
  body: { q?: string; filter?: ContactFilter; limit: number; offset: number },
) {
  const filter = await buildContactFilter({ workspaceId, userId }, body.filter);
  return pageOfContacts(
    and(contactSearch(workspaceId, body.q), filter),
    body.limit,
    body.offset,
  );
}

export async function findContact(id: string, conn: DbLike = db) {
  const [row] = await conn
    .select()
    .from(contactTable)
    .where(eq(contactTable.id, id))
    .limit(1);
  return row ?? notFound("Contact not found");
}

export async function getContact(id: string) {
  return serializeContact(await findContact(id));
}

export async function findContactByExternalId(
  workspaceId: string,
  externalId: string,
  conn: DbLike = db,
) {
  const [row] = await conn
    .select()
    .from(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        eq(contactTable.externalId, externalId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getContactByExternalId(
  workspaceId: string,
  externalId: string,
) {
  return serializeContact(
    (await findContactByExternalId(workspaceId, externalId)) ??
      notFound("Contact not found"),
  );
}

type CoreInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
  priority?: string;
};

const blankToNull = (v: string | null | undefined) =>
  v == null || v.trim() === "" ? null : v.trim();

function coreValues(input: CoreInput) {
  const out: Partial<typeof contactTable.$inferInsert> = {};
  if (input.name !== undefined) out.name = input.name.trim();
  for (const k of ["phone", "email", "externalId", "source"] as const) {
    if (input[k] !== undefined) out[k] = blankToNull(input[k]);
  }
  if (input.priority !== undefined) out.priority = input.priority;
  return out;
}

const externalIdTaken = () =>
  new HTTPException(409, {
    message: "A contact with this externalId already exists",
  });

// ---- target pools ------------------------------------------------------------------

/** Pool ids in the workspace; anything else is a 400. */
async function poolIdsInWorkspace(
  conn: DbLike,
  workspaceId: string,
  by: { ids?: string[]; slugs?: string[] },
) {
  const ids = [...new Set(by.ids ?? [])];
  const slugs = [...new Set(by.slugs ?? [])];
  if (ids.length === 0 && slugs.length === 0) return [];
  const rows = await conn
    .select({ id: poolTable.id, slug: poolTable.slug })
    .from(poolTable)
    .where(
      and(
        eq(poolTable.workspaceId, workspaceId),
        or(
          ids.length ? inArray(poolTable.id, ids) : undefined,
          slugs.length ? inArray(poolTable.slug, slugs) : undefined,
        ),
      ),
    );
  const missing = [
    ...ids.filter((id) => !rows.some((r) => r.id === id)),
    ...slugs.filter((slug) => !rows.some((r) => r.slug === slug)),
  ];
  if (missing.length) badRequest(`Unknown pool: ${missing.join(", ")}`);
  return rows.map((r) => r.id);
}

async function addTargets(
  conn: DbLike,
  contactIds: string[],
  poolIds: string[],
) {
  if (contactIds.length === 0 || poolIds.length === 0) return;
  await conn
    .insert(contactTargetPoolTable)
    .values(
      contactIds.flatMap((contactId) =>
        poolIds.map((poolId) => ({ contactId, poolId })),
      ),
    )
    .onConflictDoNothing();
}

/** Replace a contact's target pools. */
export async function setTargets(contactId: string, poolIds: string[]) {
  const contact = await findContact(contactId);
  return db.transaction(async (tx) => {
    const ids = await poolIdsInWorkspace(tx, contact.workspaceId, {
      ids: poolIds,
    });
    await tx
      .delete(contactTargetPoolTable)
      .where(eq(contactTargetPoolTable.contactId, contactId));
    await addTargets(tx, [contactId], ids);
    return serializeContact(contact, tx);
  });
}

export async function createContact(
  workspaceId: string,
  input: CoreInput & { name: string; targetPoolIds?: string[] },
) {
  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(contactTable)
        .values({ workspaceId, ...coreValues(input), name: input.name.trim() })
        .returning();
      if (!row)
        throw new HTTPException(500, { message: "Failed to create contact" });
      const poolIds = await poolIdsInWorkspace(tx, workspaceId, {
        ids: input.targetPoolIds,
      });
      await addTargets(tx, [row.id], poolIds);
      return serializeContact(row, tx);
    });
    return { ...created, created: true };
  } catch (err) {
    if (isUniqueViolation(err)) throw externalIdTaken();
    throw err;
  }
}

// Idempotent create-or-update keyed by externalId (the lead intake's entry point).
export async function upsertContactByExternalId(
  workspaceId: string,
  externalId: string,
  input: CoreInput & { targetPools?: string[] },
) {
  const run = () =>
    db.transaction(async (tx) => {
      const targetIds = await poolIdsInWorkspace(tx, workspaceId, {
        slugs: input.targetPools,
      });
      const existing = await findContactByExternalId(
        workspaceId,
        externalId,
        tx,
      );
      if (existing) {
        const patch = coreValues({ ...input, externalId: undefined });
        const row = Object.keys(patch).length
          ? ((
              await tx
                .update(contactTable)
                .set(patch)
                .where(eq(contactTable.id, existing.id))
                .returning()
            )[0] ?? existing)
          : existing;
        await addTargets(tx, [row.id], targetIds);
        return { ...(await serializeContact(row, tx)), created: false };
      }
      const name =
        input.name?.trim() ||
        badRequest("name is required to create a contact");
      const [inserted] = await tx
        .insert(contactTable)
        .values({
          workspaceId,
          ...coreValues({ ...input, externalId }),
          name,
        })
        .returning();
      if (!inserted)
        throw new HTTPException(500, { message: "Failed to create contact" });
      await addTargets(tx, [inserted.id], targetIds);
      return { ...(await serializeContact(inserted, tx)), created: true };
    });
  try {
    return await run();
  } catch (err) {
    // Two concurrent upserts for a new externalId: the loser retries as an update.
    if (isUniqueViolation(err)) return run();
    throw err;
  }
}

export async function updateContact(id: string, input: CoreInput) {
  await findContact(id);
  const patch = coreValues(input);
  if (Object.keys(patch).length === 0) return getContact(id);
  try {
    const [row] = await db
      .update(contactTable)
      .set(patch)
      .where(eq(contactTable.id, id))
      .returning();
    return serializeContact(row ?? notFound("Contact not found"));
  } catch (err) {
    if (isUniqueViolation(err)) throw externalIdTaken();
    throw err;
  }
}

export async function deleteContact(id: string) {
  await findContact(id);
  await db.delete(contactTable).where(eq(contactTable.id, id));
  return { success: true };
}

// ---- memberships -------------------------------------------------------------------

/** Every pool a contact is in, with that pool's field values. */
export async function listContactMemberships(contactId: string) {
  await findContact(contactId);
  const rows = await db
    .select({
      memberId: poolMemberTable.id,
      joinedAt: poolMemberTable.createdAt,
      id: poolTable.id,
      name: poolTable.name,
      slug: poolTable.slug,
    })
    .from(poolMemberTable)
    .innerJoin(poolTable, eq(poolTable.id, poolMemberTable.poolId))
    .where(eq(poolMemberTable.contactId, contactId))
    .orderBy(asc(poolTable.position), asc(poolTable.name));
  const values = await valuesFor(rows.map((r) => r.memberId));
  return rows.map((r) => ({
    memberId: r.memberId,
    joinedAt: r.joinedAt.toISOString(),
    pool: { id: r.id, name: r.name, slug: r.slug },
    fields: values.get(r.memberId) ?? {},
  }));
}

// ---- bulk ----------------------------------------------------------------------------

// Only ids in this workspace are touched; others are ignored, not an error.
export async function contactIdsInWorkspace(
  conn: DbLike,
  workspaceId: string,
  ids: string[],
) {
  const rows = await conn
    .select({ id: contactTable.id })
    .from(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        inArray(contactTable.id, [...new Set(ids)]),
      ),
    );
  return rows.map((r) => r.id);
}

export async function bulkUpdateContacts(
  workspaceId: string,
  body: {
    ids: string[];
    source?: string | null;
    priority?: string;
    addTargetPoolIds?: string[];
    removeTargetPoolIds?: string[];
  },
) {
  if (
    body.source === undefined &&
    body.priority === undefined &&
    !body.addTargetPoolIds?.length &&
    !body.removeTargetPoolIds?.length
  )
    badRequest("Nothing to update");
  return db.transaction(async (tx) => {
    const ids = await contactIdsInWorkspace(tx, workspaceId, body.ids);
    if (ids.length === 0) return { updated: 0 };
    const add = await poolIdsInWorkspace(tx, workspaceId, {
      ids: body.addTargetPoolIds,
    });
    await addTargets(tx, ids, add);
    if (body.removeTargetPoolIds?.length) {
      await tx
        .delete(contactTargetPoolTable)
        .where(
          and(
            inArray(contactTargetPoolTable.contactId, ids),
            inArray(contactTargetPoolTable.poolId, body.removeTargetPoolIds),
          ),
        );
    }
    await tx
      .update(contactTable)
      .set({
        ...(body.source !== undefined
          ? { source: blankToNull(body.source) }
          : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        updatedAt: new Date(),
      })
      .where(inArray(contactTable.id, ids));
    return { updated: ids.length };
  });
}

export async function bulkDeleteContacts(workspaceId: string, ids: string[]) {
  const rows = await db
    .delete(contactTable)
    .where(
      and(
        eq(contactTable.workspaceId, workspaceId),
        inArray(contactTable.id, [...new Set(ids)]),
      ),
    )
    .returning({ id: contactTable.id });
  return { deleted: rows.length };
}

// ---- task links ----------------------------------------------------------------------

export async function listContactTasks(contactId: string, userId: string) {
  await findContact(contactId);
  const rows = await db
    .select({
      taskId: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      columnName: columnTable.name,
      linkedAt: taskContactTable.createdAt,
    })
    .from(taskContactTable)
    .innerJoin(taskTable, eq(taskContactTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .innerJoin(contactTable, eq(taskContactTable.contactId, contactTable.id))
    .where(
      and(
        eq(taskContactTable.contactId, contactId),
        // Never expose links that drifted into another workspace, nor tasks
        // on projects this member cannot see.
        eq(projectTable.workspaceId, contactTable.workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(desc(taskContactTable.createdAt));
  return rows.map((r) => ({ ...r, linkedAt: r.linkedAt.toISOString() }));
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

export async function linkTask(
  contactId: string,
  taskId: string,
  userId: string,
) {
  const contact = await findContact(contactId);
  const scope = await taskScope(taskId);
  if (scope.workspaceId !== contact.workspaceId)
    badRequest("Task and contact are in different workspaces");
  await assertProjectAccess(userId, scope.projectId);
  const [row] = await db
    .insert(taskContactTable)
    .values({ taskId, contactId, createdBy: userId })
    .onConflictDoNothing()
    .returning({ id: taskContactTable.id });
  return { taskId, contactId, created: !!row };
}

export async function unlinkTask(
  contactId: string,
  taskId: string,
  userId: string,
) {
  await findContact(contactId);
  const scope = await taskScope(taskId);
  await assertProjectAccess(userId, scope.projectId);
  await db
    .delete(taskContactTable)
    .where(
      and(
        eq(taskContactTable.contactId, contactId),
        eq(taskContactTable.taskId, taskId),
      ),
    );
  return { success: true };
}

export async function listTaskContacts(taskId: string) {
  const rows = await db
    .select({ contact: contactTable })
    .from(taskContactTable)
    .innerJoin(contactTable, eq(taskContactTable.contactId, contactTable.id))
    .innerJoin(taskTable, eq(taskContactTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskContactTable.taskId, taskId),
        eq(projectTable.workspaceId, contactTable.workspaceId),
      ),
    )
    .orderBy(asc(taskContactTable.createdAt));
  return serializeContacts(rows.map((r) => r.contact));
}
