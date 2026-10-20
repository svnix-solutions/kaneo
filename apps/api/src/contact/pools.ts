// Pools: workspace lists (like projects) that contacts join as members, each
// with its own field definitions.
import { and, asc, count, desc, eq, inArray, max, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable } from "../database/schema";
import {
  contactIdsInWorkspace,
  contactSearch,
  findContact,
  findContactByExternalId,
  serializeContactCore,
  type Contact,
} from "./contacts";
import {
  badRequest,
  type DbLike,
  type FieldType,
  type InputValue,
  isUniqueViolation,
  notFound,
  resolveFields,
  valuesFor,
  writeValues,
} from "./fields";
import { buildContactFilter, type ContactFilter } from "./filter";
import { pipelinesFor } from "./pipelines";
import { contactTable, poolMemberTable, poolTable } from "./schema";

type Pool = typeof poolTable.$inferSelect;
type Member = typeof poolMemberTable.$inferSelect;

function serializePool(p: Pool, memberCount: number) {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    icon: p.icon,
    position: p.position,
    screeningProjectId: p.screeningProjectId,
    memberCount,
    createdAt: p.createdAt.toISOString(),
  };
}

async function memberCounts(poolIds: string[]) {
  if (poolIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ poolId: poolMemberTable.poolId, n: count() })
    .from(poolMemberTable)
    .where(inArray(poolMemberTable.poolId, poolIds))
    .groupBy(poolMemberTable.poolId);
  return new Map(rows.map((r) => [r.poolId, r.n]));
}

export async function findPool(id: string, conn: DbLike = db) {
  const [row] = await conn
    .select()
    .from(poolTable)
    .where(eq(poolTable.id, id))
    .limit(1);
  return row ?? notFound("Pool not found");
}

export async function listPools(workspaceId: string) {
  const rows = await db
    .select()
    .from(poolTable)
    .where(eq(poolTable.workspaceId, workspaceId))
    .orderBy(asc(poolTable.position), asc(poolTable.name));
  const counts = await memberCounts(rows.map((r) => r.id));
  return rows.map((r) => serializePool(r, counts.get(r.id) ?? 0));
}

export async function getPool(id: string) {
  const pool = await findPool(id);
  return serializePool(pool, (await memberCounts([id])).get(id) ?? 0);
}

export async function getPoolBySlug(workspaceId: string, slug: string) {
  const [row] = await db
    .select()
    .from(poolTable)
    .where(
      and(eq(poolTable.workspaceId, workspaceId), eq(poolTable.slug, slug)),
    )
    .limit(1);
  const pool = row ?? notFound(`No pool with slug "${slug}"`);
  return serializePool(pool, (await memberCounts([pool.id])).get(pool.id) ?? 0);
}

/** A pool's screening board must be a board of the same workspace. */
async function assertBoardInWorkspace(
  workspaceId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return;
  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  if (project?.workspaceId !== workspaceId)
    badRequest("Screening board not found in this workspace");
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "pool"
  );
}

const slugTaken = (slug: string) =>
  new HTTPException(409, {
    message: `A pool with slug "${slug}" already exists`,
  });

export async function createPool(
  workspaceId: string,
  body: {
    name: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    screeningProjectId?: string | null;
  },
) {
  await assertBoardInWorkspace(workspaceId, body.screeningProjectId);
  const [pos] = await db
    .select({ max: max(poolTable.position) })
    .from(poolTable)
    .where(eq(poolTable.workspaceId, workspaceId));
  const insert = (slug: string) =>
    db
      .insert(poolTable)
      .values({
        workspaceId,
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        screeningProjectId: body.screeningProjectId ?? null,
        icon: body.icon?.trim() || null,
        position: (pos?.max ?? 0) + 1,
      })
      .onConflictDoNothing()
      .returning();

  // An explicit slug must be free; a derived one gets a numeric suffix.
  if (body.slug) {
    const [row] = await insert(body.slug);
    if (!row) throw slugTaken(body.slug);
    return serializePool(row, 0);
  }
  const base = slugify(body.name);
  for (let i = 1; i <= 50; i++) {
    const [row] = await insert(i === 1 ? base : `${base}-${i}`);
    if (row) return serializePool(row, 0);
  }
  throw slugTaken(base);
}

export async function updatePool(
  id: string,
  body: {
    name?: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    position?: number;
    screeningProjectId?: string | null;
  },
) {
  const pool = await findPool(id);
  await assertBoardInWorkspace(pool.workspaceId, body.screeningProjectId);
  const patch: Partial<typeof poolTable.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.slug !== undefined) patch.slug = body.slug;
  if (body.description !== undefined)
    patch.description = body.description?.trim() || null;
  if (body.icon !== undefined) patch.icon = body.icon?.trim() || null;
  if (body.position !== undefined) patch.position = body.position;
  if (body.screeningProjectId !== undefined)
    patch.screeningProjectId = body.screeningProjectId;
  if (Object.keys(patch).length === 0) return getPool(id);
  try {
    await db.update(poolTable).set(patch).where(eq(poolTable.id, id));
  } catch (err) {
    if (isUniqueViolation(err)) throw slugTaken(body.slug ?? "");
    throw err;
  }
  return getPool(id);
}

/** Deletes the pool with its fields and memberships; contacts are kept. */
export async function deletePool(id: string) {
  await findPool(id);
  await db.delete(poolTable).where(eq(poolTable.id, id));
  return { success: true };
}

// ---- members -------------------------------------------------------------------------

function serializeMember(
  contact: Contact,
  member: Member,
  fields: Record<string, string | null>,
) {
  return {
    ...serializeContactCore(contact),
    memberId: member.id,
    poolId: member.poolId,
    joinedAt: member.createdAt.toISOString(),
    fields,
  };
}

async function pageOfMembers(
  where: SQL | undefined,
  limit: number,
  offset: number,
  userId: string,
) {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ contact: contactTable, member: poolMemberTable })
      .from(poolMemberTable)
      .innerJoin(contactTable, eq(contactTable.id, poolMemberTable.contactId))
      .where(where)
      .orderBy(desc(poolMemberTable.updatedAt), asc(poolMemberTable.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(poolMemberTable)
      .innerJoin(contactTable, eq(contactTable.id, poolMemberTable.contactId))
      .where(where),
  ]);
  const memberIds = rows.map((r) => r.member.id);
  const [values, pipelines] = await Promise.all([
    valuesFor(memberIds),
    pipelinesFor(memberIds, userId),
  ]);
  return {
    items: rows.map((r) => ({
      ...serializeMember(r.contact, r.member, values.get(r.member.id) ?? {}),
      pipelines: pipelines.get(r.member.id) ?? [],
    })),
    total: totalRow?.total ?? 0,
  };
}

export async function queryMembers(
  poolId: string,
  userId: string,
  body: { q?: string; filter?: ContactFilter; limit: number; offset: number },
) {
  const pool = await findPool(poolId);
  const filter = await buildContactFilter(
    { workspaceId: pool.workspaceId, userId, poolId },
    body.filter,
  );
  return pageOfMembers(
    and(
      eq(poolMemberTable.poolId, poolId),
      contactSearch(pool.workspaceId, body.q),
      filter,
    ),
    body.limit,
    body.offset,
    userId,
  );
}

type ValuesBody = {
  values?: Record<string, InputValue>;
  createMissing?: boolean;
  types?: Record<string, FieldType>;
};

async function upsertMemberOf(pool: Pool, contact: Contact, body: ValuesBody) {
  if (contact.workspaceId !== pool.workspaceId)
    badRequest("Contact and pool are in different workspaces");
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(poolMemberTable)
      .values({ poolId: pool.id, contactId: contact.id })
      .onConflictDoNothing()
      .returning();
    const member =
      inserted ??
      (
        await tx
          .select()
          .from(poolMemberTable)
          .where(
            and(
              eq(poolMemberTable.poolId, pool.id),
              eq(poolMemberTable.contactId, contact.id),
            ),
          )
          .limit(1)
      )[0];
    if (!member)
      throw new HTTPException(500, { message: "Failed to add to pool" });
    const { resolved, createdFields } = await resolveFields(
      tx,
      pool.id,
      body.values ?? {},
      body.createMissing ?? false,
      body.types,
    );
    await writeValues(tx, [member.id], resolved);
    const fields = (await valuesFor([member.id], tx)).get(member.id) ?? {};
    return {
      ...serializeMember(contact, member, fields),
      created: !!inserted,
      createdFields,
    };
  });
}

/** Add a contact to a pool (idempotent) and set pool field values. */
export async function upsertMember(
  poolId: string,
  contactId: string,
  body: ValuesBody,
) {
  return upsertMemberOf(
    await findPool(poolId),
    await findContact(contactId),
    body,
  );
}

/** Same, finding the contact by its external id (an enrichment flow's entry point). */
export async function upsertMemberByExternalId(
  poolId: string,
  externalId: string,
  body: ValuesBody,
) {
  const pool = await findPool(poolId);
  const contact =
    (await findContactByExternalId(pool.workspaceId, externalId)) ??
    notFound(`No contact with external id "${externalId}"`);
  return upsertMemberOf(pool, contact, body);
}

export async function removeMember(poolId: string, contactId: string) {
  await findPool(poolId);
  await db
    .delete(poolMemberTable)
    .where(
      and(
        eq(poolMemberTable.poolId, poolId),
        eq(poolMemberTable.contactId, contactId),
      ),
    );
  return { success: true };
}

export async function bulkAddMembers(poolId: string, ids: string[]) {
  const pool = await findPool(poolId);
  const contactIds = await contactIdsInWorkspace(db, pool.workspaceId, ids);
  if (contactIds.length === 0) return { added: 0 };
  const rows = await db
    .insert(poolMemberTable)
    .values(contactIds.map((contactId) => ({ poolId, contactId })))
    .onConflictDoNothing()
    .returning({ id: poolMemberTable.id });
  return { added: rows.length };
}

export async function bulkRemoveMembers(poolId: string, ids: string[]) {
  await findPool(poolId);
  const rows = await db
    .delete(poolMemberTable)
    .where(
      and(
        eq(poolMemberTable.poolId, poolId),
        inArray(poolMemberTable.contactId, [...new Set(ids)]),
      ),
    )
    .returning({ id: poolMemberTable.id });
  return { removed: rows.length };
}

/** Set field values on many members; ids are contact ids, non-members are ignored. */
export async function bulkUpdateMembers(
  poolId: string,
  body: { ids: string[]; values: Record<string, InputValue> },
) {
  await findPool(poolId);
  if (Object.keys(body.values).length === 0)
    badRequest("Nothing to update: give values");
  return db.transaction(async (tx) => {
    const members = await tx
      .select({ id: poolMemberTable.id })
      .from(poolMemberTable)
      .where(
        and(
          eq(poolMemberTable.poolId, poolId),
          inArray(poolMemberTable.contactId, [...new Set(body.ids)]),
        ),
      );
    if (members.length === 0) return { updated: 0 };
    const { resolved } = await resolveFields(
      tx,
      poolId,
      body.values,
      false,
      undefined,
    );
    await writeValues(
      tx,
      members.map((m) => m.id),
      resolved,
    );
    return { updated: members.length };
  });
}
