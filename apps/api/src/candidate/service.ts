import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  max,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, projectTable, taskTable } from "../database/schema";
import { assertValidDefinition } from "../custom-field/assert-valid-definition";
import { normalizeOptions, readOptions } from "../custom-field/choice-options";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { escapeLikePattern } from "../search/like-pattern";
import { validateCustomFieldValue } from "../task/validate-task-fields";
import { buildCandidateFilter, type CandidateFilter } from "./filter";
import {
  candidateFieldDefinitionTable as fieldTable,
  candidateFieldValueTable as valueTable,
  candidateTable,
  taskCandidateTable,
} from "./schema";

type Candidate = typeof candidateTable.$inferSelect;
type FieldDef = typeof fieldTable.$inferSelect;
type FieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "boolean"
  | "multiselect";
type InputValue = string | number | boolean | string[] | null;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

const AUTO_CREATE_TYPES = new Set<FieldType>([
  "text",
  "number",
  "date",
  "boolean",
]);

const badRequest = (message: string): never => {
  throw new HTTPException(400, { message });
};
const notFound = (message: string): never => {
  throw new HTTPException(404, { message });
};
const isUniqueViolation = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: string }).code === "23505";

// ---- serialization ------------------------------------------------------------

export function serializeField(f: FieldDef) {
  return {
    id: f.id,
    workspaceId: f.workspaceId,
    name: f.name,
    type: f.type,
    required: f.required,
    defaultValue: f.defaultValue,
    options: f.options == null ? null : readOptions(f.options),
    position: f.position,
  };
}

async function valuesFor(candidateIds: string[], conn: DbLike = db) {
  const map = new Map<string, Record<string, string | null>>();
  if (candidateIds.length === 0) return map;
  const rows = await conn
    .select({
      candidateId: valueTable.candidateId,
      fieldId: valueTable.fieldId,
      value: valueTable.value,
    })
    .from(valueTable)
    .where(inArray(valueTable.candidateId, candidateIds));
  for (const r of rows) {
    const m = map.get(r.candidateId) ?? {};
    m[r.fieldId] = r.value;
    map.set(r.candidateId, m);
  }
  return map;
}

function serializeCandidate(
  c: Candidate,
  fields: Record<string, string | null> = {},
) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    externalId: c.externalId,
    source: c.source,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    fields,
  };
}

async function withValues(c: Candidate, conn: DbLike = db) {
  return serializeCandidate(c, (await valuesFor([c.id], conn)).get(c.id) ?? {});
}

// ---- candidates ----------------------------------------------------------------

export async function listCandidates(
  workspaceId: string,
  q: string | undefined,
  limit: number,
  offset: number,
) {
  return pageOfCandidates(candidateWhere(workspaceId, q), limit, offset);
}

// Search plus advanced filter (see ./filter); same page shape as the list.
export async function queryCandidates(
  workspaceId: string,
  userId: string,
  body: {
    q?: string;
    filter?: CandidateFilter;
    limit: number;
    offset: number;
  },
) {
  const filter = await buildCandidateFilter(workspaceId, userId, body.filter);
  return pageOfCandidates(
    and(candidateWhere(workspaceId, body.q), filter),
    body.limit,
    body.offset,
  );
}

function candidateWhere(workspaceId: string, q: string | undefined) {
  const term = q?.trim();
  return term
    ? and(
        eq(candidateTable.workspaceId, workspaceId),
        or(
          ...[
            candidateTable.name,
            candidateTable.phone,
            candidateTable.email,
            candidateTable.externalId,
          ].map((col) => ilike(col, `%${escapeLikePattern(term)}%`)),
        ),
      )
    : eq(candidateTable.workspaceId, workspaceId);
}

async function pageOfCandidates(
  where: SQL | undefined,
  limit: number,
  offset: number,
) {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(candidateTable)
      .where(where)
      .orderBy(desc(candidateTable.updatedAt), asc(candidateTable.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(candidateTable).where(where),
  ]);
  const values = await valuesFor(rows.map((r) => r.id));
  return {
    items: rows.map((r) => serializeCandidate(r, values.get(r.id) ?? {})),
    total: totalRow?.total ?? 0,
  };
}

async function findCandidate(id: string, conn: DbLike = db) {
  const [row] = await conn
    .select()
    .from(candidateTable)
    .where(eq(candidateTable.id, id))
    .limit(1);
  return row ?? notFound("Candidate not found");
}

export async function getCandidate(id: string) {
  return withValues(await findCandidate(id));
}

export async function getCandidateByExternalId(
  workspaceId: string,
  externalId: string,
) {
  const [row] = await db
    .select()
    .from(candidateTable)
    .where(
      and(
        eq(candidateTable.workspaceId, workspaceId),
        eq(candidateTable.externalId, externalId),
      ),
    )
    .limit(1);
  return withValues(row ?? notFound("Candidate not found"));
}

type CoreInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
};

const blankToNull = (v: string | null | undefined) =>
  v == null || v.trim() === "" ? null : v.trim();

function coreValues(input: CoreInput) {
  const out: Partial<typeof candidateTable.$inferInsert> = {};
  if (input.name !== undefined) out.name = input.name.trim();
  for (const k of ["phone", "email", "externalId", "source"] as const) {
    if (input[k] !== undefined) out[k] = blankToNull(input[k]);
  }
  return out;
}

export async function createCandidate(
  workspaceId: string,
  input: CoreInput & {
    name: string;
    fields?: Record<string, InputValue>;
    createMissingFields?: boolean;
  },
) {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(candidateTable)
        .values({ workspaceId, ...coreValues(input), name: input.name.trim() })
        .returning();
      if (!created)
        throw new HTTPException(500, { message: "Failed to create candidate" });
      const createdFields = input.fields
        ? (
            await applyValues(
              tx,
              created,
              input.fields,
              input.createMissingFields ?? false,
              undefined,
            )
          ).createdFields
        : [];
      return {
        ...(await withValues(created, tx)),
        created: true,
        createdFields,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw new HTTPException(409, {
        message: "A candidate with this externalId already exists",
      });
    throw err;
  }
}

// Idempotent create-or-update keyed by externalId (the glue's entry point).
export async function upsertCandidateByExternalId(
  workspaceId: string,
  externalId: string,
  input: CoreInput & {
    fields?: Record<string, InputValue>;
    createMissingFields?: boolean;
  },
) {
  const run = () =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(candidateTable)
        .where(
          and(
            eq(candidateTable.workspaceId, workspaceId),
            eq(candidateTable.externalId, externalId),
          ),
        )
        .limit(1);
      let row: Candidate;
      let created = false;
      if (existing) {
        const patch = coreValues({ ...input, externalId: undefined });
        row = Object.keys(patch).length
          ? ((
              await tx
                .update(candidateTable)
                .set(patch)
                .where(eq(candidateTable.id, existing.id))
                .returning()
            )[0] ?? existing)
          : existing;
      } else {
        if (!input.name?.trim())
          badRequest("name is required to create a candidate");
        const [inserted] = await tx
          .insert(candidateTable)
          .values({
            workspaceId,
            ...coreValues({ ...input, externalId }),
            name: (input.name as string).trim(),
          })
          .returning();
        if (!inserted)
          throw new HTTPException(500, {
            message: "Failed to create candidate",
          });
        row = inserted;
        created = true;
      }
      const createdFields = input.fields
        ? (
            await applyValues(
              tx,
              row,
              input.fields,
              input.createMissingFields ?? false,
              undefined,
            )
          ).createdFields
        : [];
      return { ...(await withValues(row, tx)), created, createdFields };
    });
  try {
    return await run();
  } catch (err) {
    // Two concurrent upserts for a new externalId: the loser retries as an update.
    if (isUniqueViolation(err)) return run();
    throw err;
  }
}

export async function updateCandidate(id: string, input: CoreInput) {
  await findCandidate(id);
  const patch = coreValues(input);
  if (Object.keys(patch).length === 0) return getCandidate(id);
  try {
    const [row] = await db
      .update(candidateTable)
      .set(patch)
      .where(eq(candidateTable.id, id))
      .returning();
    return withValues(row ?? notFound("Candidate not found"));
  } catch (err) {
    if (isUniqueViolation(err))
      throw new HTTPException(409, {
        message: "A candidate with this externalId already exists",
      });
    throw err;
  }
}

export async function deleteCandidate(id: string) {
  await findCandidate(id);
  await db.delete(candidateTable).where(eq(candidateTable.id, id));
  return { success: true };
}

// ---- bulk ----------------------------------------------------------------------------

// Only ids in this workspace are touched; others are ignored, not an error.
async function idsInWorkspace(
  conn: DbLike,
  workspaceId: string,
  ids: string[],
) {
  const rows = await conn
    .select({ id: candidateTable.id })
    .from(candidateTable)
    .where(
      and(
        eq(candidateTable.workspaceId, workspaceId),
        inArray(candidateTable.id, [...new Set(ids)]),
      ),
    );
  return rows.map((r) => r.id);
}

export async function bulkUpdateCandidates(
  workspaceId: string,
  body: {
    ids: string[];
    source?: string | null;
    values?: Record<string, InputValue>;
  },
) {
  const entries = Object.entries(body.values ?? {})
    .map(([name, value]) => [name.trim(), value] as const)
    .filter(([name]) => name);
  if (entries.length === 0 && body.source === undefined)
    badRequest("Nothing to update: give source or values");

  return db.transaction(async (tx) => {
    const ids = await idsInWorkspace(tx, workspaceId, body.ids);
    if (ids.length === 0) return { updated: 0 };

    const defs = await tx
      .select()
      .from(fieldTable)
      .where(eq(fieldTable.workspaceId, workspaceId));
    const byName = new Map(defs.map((d) => [d.name.toLowerCase(), d]));
    for (const [name, value] of entries) {
      const field =
        byName.get(name.toLowerCase()) ??
        badRequest(`Unknown candidate field "${name}"`);
      if (
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0)
      ) {
        await tx
          .delete(valueTable)
          .where(
            and(
              eq(valueTable.fieldId, field.id),
              inArray(valueTable.candidateId, ids),
            ),
          );
        continue;
      }
      const stored = coerceValue(field, value);
      await tx
        .insert(valueTable)
        .values(
          ids.map((candidateId) => ({
            candidateId,
            fieldId: field.id,
            value: stored,
          })),
        )
        .onConflictDoUpdate({
          target: [valueTable.candidateId, valueTable.fieldId],
          set: { value: stored, updatedAt: new Date() },
        });
    }

    await tx
      .update(candidateTable)
      .set({
        ...(body.source !== undefined
          ? { source: blankToNull(body.source) }
          : {}),
        updatedAt: new Date(),
      })
      .where(inArray(candidateTable.id, ids));
    return { updated: ids.length };
  });
}

export async function bulkDeleteCandidates(workspaceId: string, ids: string[]) {
  const rows = await db
    .delete(candidateTable)
    .where(
      and(
        eq(candidateTable.workspaceId, workspaceId),
        inArray(candidateTable.id, [...new Set(ids)]),
      ),
    )
    .returning({ id: candidateTable.id });
  return { deleted: rows.length };
}

// ---- field definitions ------------------------------------------------------------

export async function listFields(workspaceId: string) {
  const rows = await db
    .select()
    .from(fieldTable)
    .where(eq(fieldTable.workspaceId, workspaceId))
    .orderBy(asc(fieldTable.position), asc(fieldTable.createdAt));
  return rows.map(serializeField);
}

async function insertField(
  conn: DbLike,
  workspaceId: string,
  def: {
    name: string;
    type: FieldType;
    required?: boolean;
    defaultValue?: string | null;
    options?: string[] | null;
  },
) {
  const options = def.options ? normalizeOptions(def.options) : null;
  assertValidDefinition({
    name: def.name,
    type: def.type,
    required: def.required ?? false,
    defaultValue: def.defaultValue,
    options,
  });
  const [pos] = await conn
    .select({ max: max(fieldTable.position) })
    .from(fieldTable)
    .where(eq(fieldTable.workspaceId, workspaceId));
  const [created] = await conn
    .insert(fieldTable)
    .values({
      workspaceId,
      name: def.name.trim(),
      type: def.type,
      required: def.required ?? false,
      defaultValue: def.defaultValue ?? null,
      options,
      position: (pos?.max ?? 0) + 1,
    })
    .onConflictDoNothing()
    .returning();
  return created ?? null;
}

export async function createField(
  workspaceId: string,
  body: Parameters<typeof insertField>[2],
) {
  const created = await insertField(db, workspaceId, body);
  if (!created)
    throw new HTTPException(409, {
      message: `A candidate field named "${body.name}" already exists`,
    });
  return serializeField(created);
}

export async function updateField(
  fieldId: string,
  body: {
    name?: string;
    required?: boolean;
    defaultValue?: string | null;
    options?: string[];
    position?: number;
  },
) {
  const [field] = await db
    .select()
    .from(fieldTable)
    .where(eq(fieldTable.id, fieldId))
    .limit(1);
  if (!field) notFound("Candidate field not found");
  const f = field as FieldDef;
  const next = {
    name: body.name?.trim() ?? f.name,
    type: f.type,
    required: body.required ?? f.required,
    defaultValue:
      body.defaultValue === undefined ? f.defaultValue : body.defaultValue,
    options: body.options
      ? normalizeOptions(body.options)
      : f.options == null
        ? null
        : readOptions(f.options),
  };
  assertValidDefinition(next);
  if (body.options && (f.type === "dropdown" || f.type === "multiselect")) {
    // Removing an option that candidates still use would silently orphan values.
    const used = await db
      .select({ value: valueTable.value })
      .from(valueTable)
      .where(eq(valueTable.fieldId, fieldId));
    const keep = new Set(next.options ?? []);
    const missing = new Set<string>();
    for (const { value } of used) {
      const picked =
        f.type === "dropdown"
          ? [value ?? ""]
          : (() => {
              try {
                return JSON.parse(value ?? "[]") as string[];
              } catch {
                return [];
              }
            })();
      for (const p of picked) if (p && !keep.has(p)) missing.add(p);
    }
    if (missing.size)
      badRequest(`Options still in use: ${[...missing].join(", ")}`);
  }
  try {
    const [row] = await db
      .update(fieldTable)
      .set({
        ...next,
        ...(body.position !== undefined ? { position: body.position } : {}),
      })
      .where(eq(fieldTable.id, fieldId))
      .returning();
    return serializeField(row as FieldDef);
  } catch (err) {
    if (isUniqueViolation(err))
      throw new HTTPException(409, {
        message: `A candidate field named "${next.name}" already exists`,
      });
    throw err;
  }
}

export async function deleteField(fieldId: string) {
  const [row] = await db
    .delete(fieldTable)
    .where(eq(fieldTable.id, fieldId))
    .returning({ id: fieldTable.id });
  if (!row) notFound("Candidate field not found");
  return { success: true };
}

// ---- values ------------------------------------------------------------------------

function inferType(value: InputValue): FieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}

// Coerce an input value into the stored string for a field, validated.
function coerceValue(
  field: FieldDef,
  value: Exclude<InputValue, null>,
): string {
  const type = field.type as FieldType;
  let stored: string;
  if (type === "multiselect") {
    const arr = Array.isArray(value) ? value : [String(value)];
    stored = JSON.stringify(arr.map((v) => v.trim()).filter(Boolean));
  } else if (Array.isArray(value)) {
    if (type !== "text")
      badRequest(`Field "${field.name}" does not accept a list`);
    stored = value.join(", ");
  } else if (type === "boolean") {
    const s = String(value).trim().toLowerCase();
    stored = ["true", "yes", "1"].includes(s)
      ? "true"
      : ["false", "no", "0"].includes(s)
        ? "false"
        : s;
  } else {
    stored = String(value).trim();
  }
  if (type !== "text") {
    const error = validateCustomFieldValue(
      stored,
      type,
      field.name,
      field.options,
    );
    if (error) badRequest(error);
  }
  return stored;
}

async function applyValues(
  tx: Tx,
  candidate: Candidate,
  values: Record<string, InputValue>,
  createMissing: boolean,
  types: Record<string, FieldType> | undefined,
) {
  const defs = await tx
    .select()
    .from(fieldTable)
    .where(eq(fieldTable.workspaceId, candidate.workspaceId));
  const byName = new Map(defs.map((d) => [d.name.toLowerCase(), d]));
  const createdFields: ReturnType<typeof serializeField>[] = [];
  const typeFor = (name: string) =>
    Object.entries(types ?? {}).find(
      ([k]) => k.toLowerCase() === name.toLowerCase(),
    )?.[1];

  for (const [rawName, value] of Object.entries(values)) {
    const name = rawName.trim();
    if (!name) continue;
    let field = byName.get(name.toLowerCase());
    if (!field) {
      if (value === null || (typeof value === "string" && value.trim() === ""))
        continue;
      if (!createMissing) badRequest(`Unknown candidate field "${name}"`);
      const type = typeFor(name) ?? inferType(value);
      if (!AUTO_CREATE_TYPES.has(type)) {
        badRequest(
          `Field "${name}" of type ${type} must be defined (with its options) before values are set`,
        );
      }
      const created =
        (await insertField(tx, candidate.workspaceId, { name, type })) ??
        (
          await tx
            .select()
            .from(fieldTable)
            .where(
              and(
                eq(fieldTable.workspaceId, candidate.workspaceId),
                sql`lower(${fieldTable.name}) = ${name.toLowerCase()}`,
              ),
            )
            .limit(1)
        )[0];
      if (!created)
        throw new HTTPException(500, {
          message: `Failed to create field "${name}"`,
        });
      field = created;
      byName.set(name.toLowerCase(), field);
      createdFields.push(serializeField(field));
    }
    if (value === null || (typeof value === "string" && value.trim() === "")) {
      await tx
        .delete(valueTable)
        .where(
          and(
            eq(valueTable.candidateId, candidate.id),
            eq(valueTable.fieldId, field.id),
          ),
        );
      continue;
    }
    const stored = coerceValue(field, value);
    await tx
      .insert(valueTable)
      .values({ candidateId: candidate.id, fieldId: field.id, value: stored })
      .onConflictDoUpdate({
        target: [valueTable.candidateId, valueTable.fieldId],
        set: { value: stored, updatedAt: new Date() },
      });
  }
  // Touch the candidate so lists sort by latest activity.
  await tx
    .update(candidateTable)
    .set({ updatedAt: new Date() })
    .where(eq(candidateTable.id, candidate.id));
  return { createdFields };
}

export async function setCandidateValues(
  candidateId: string,
  body: {
    values: Record<string, InputValue>;
    createMissing?: boolean;
    types?: Record<string, FieldType>;
  },
) {
  return db.transaction(async (tx) => {
    const candidate = await findCandidate(candidateId, tx);
    const { createdFields } = await applyValues(
      tx,
      candidate,
      body.values,
      body.createMissing ?? false,
      body.types,
    );
    const fields = (await valuesFor([candidateId], tx)).get(candidateId) ?? {};
    return { fields, createdFields };
  });
}

// ---- task links ----------------------------------------------------------------------

export async function listCandidateTasks(candidateId: string, userId: string) {
  await findCandidate(candidateId);
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
      linkedAt: taskCandidateTable.createdAt,
    })
    .from(taskCandidateTable)
    .innerJoin(taskTable, eq(taskCandidateTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .innerJoin(
      candidateTable,
      eq(taskCandidateTable.candidateId, candidateTable.id),
    )
    .where(
      and(
        eq(taskCandidateTable.candidateId, candidateId),
        // Never expose links that drifted into another workspace, nor tasks
        // on projects this member cannot see.
        eq(projectTable.workspaceId, candidateTable.workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(desc(taskCandidateTable.createdAt));
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
  candidateId: string,
  taskId: string,
  userId: string,
) {
  const candidate = await findCandidate(candidateId);
  const scope = await taskScope(taskId);
  if (scope.workspaceId !== candidate.workspaceId)
    badRequest("Task and candidate are in different workspaces");
  await assertProjectAccess(userId, scope.projectId);
  const [row] = await db
    .insert(taskCandidateTable)
    .values({ taskId, candidateId, createdBy: userId })
    .onConflictDoNothing()
    .returning({ id: taskCandidateTable.id });
  return { taskId, candidateId, created: !!row };
}

export async function unlinkTask(
  candidateId: string,
  taskId: string,
  userId: string,
) {
  await findCandidate(candidateId);
  const scope = await taskScope(taskId);
  await assertProjectAccess(userId, scope.projectId);
  await db
    .delete(taskCandidateTable)
    .where(
      and(
        eq(taskCandidateTable.candidateId, candidateId),
        eq(taskCandidateTable.taskId, taskId),
      ),
    );
  return { success: true };
}

export async function listTaskCandidates(taskId: string) {
  const rows = await db
    .select({ candidate: candidateTable })
    .from(taskCandidateTable)
    .innerJoin(
      candidateTable,
      eq(taskCandidateTable.candidateId, candidateTable.id),
    )
    .innerJoin(taskTable, eq(taskCandidateTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskCandidateTable.taskId, taskId),
        eq(projectTable.workspaceId, candidateTable.workspaceId),
      ),
    )
    .orderBy(asc(taskCandidateTable.createdAt));
  const values = await valuesFor(rows.map((r) => r.candidate.id));
  return rows.map((r) =>
    serializeCandidate(r.candidate, values.get(r.candidate.id) ?? {}),
  );
}
