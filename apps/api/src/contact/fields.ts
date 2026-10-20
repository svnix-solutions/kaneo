// Pool field definitions and member field values.
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { assertValidDefinition } from "../custom-field/assert-valid-definition";
import { normalizeOptions, readOptions } from "../custom-field/choice-options";
import { validateCustomFieldValue } from "../task/validate-task-fields";
import {
  poolFieldDefinitionTable as fieldTable,
  poolMemberTable,
  poolFieldValueTable as valueTable,
} from "./schema";

export type FieldDef = typeof fieldTable.$inferSelect;
export type FieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "boolean"
  | "multiselect";
export type InputValue = string | number | boolean | string[] | null;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbLike = typeof db | Tx;

const AUTO_CREATE_TYPES = new Set<FieldType>([
  "text",
  "number",
  "date",
  "boolean",
]);

export const badRequest = (message: string): never => {
  throw new HTTPException(400, { message });
};
export const notFound = (message: string): never => {
  throw new HTTPException(404, { message });
};
// Drizzle wraps driver errors; the Postgres code may sit on the cause.
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  ((err as { code?: string }).code === "23505" ||
    isUniqueViolation((err as { cause?: unknown }).cause));

export const isBlankValue = (value: InputValue) =>
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

export function serializeField(f: FieldDef) {
  return {
    id: f.id,
    poolId: f.poolId,
    name: f.name,
    type: f.type,
    required: f.required,
    defaultValue: f.defaultValue,
    options: f.options == null ? null : readOptions(f.options),
    position: f.position,
  };
}

/** Field values by member id, each keyed by field id. */
export async function valuesFor(memberIds: string[], conn: DbLike = db) {
  const map = new Map<string, Record<string, string | null>>();
  if (memberIds.length === 0) return map;
  const rows = await conn
    .select({
      memberId: valueTable.memberId,
      fieldId: valueTable.fieldId,
      value: valueTable.value,
    })
    .from(valueTable)
    .where(inArray(valueTable.memberId, memberIds));
  for (const r of rows) {
    const m = map.get(r.memberId) ?? {};
    m[r.fieldId] = r.value;
    map.set(r.memberId, m);
  }
  return map;
}

// ---- definitions -------------------------------------------------------------------

export async function listFields(poolId: string) {
  const rows = await db
    .select()
    .from(fieldTable)
    .where(eq(fieldTable.poolId, poolId))
    .orderBy(asc(fieldTable.position), asc(fieldTable.createdAt));
  return rows.map(serializeField);
}

async function insertField(
  conn: DbLike,
  poolId: string,
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
    .where(eq(fieldTable.poolId, poolId));
  const [created] = await conn
    .insert(fieldTable)
    .values({
      poolId,
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
  poolId: string,
  body: Parameters<typeof insertField>[2],
) {
  const created = await insertField(db, poolId, body);
  if (!created)
    throw new HTTPException(409, {
      message: `A field named "${body.name}" already exists in this pool`,
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
  const f = field ?? notFound("Pool field not found");
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
    // Removing an option that members still use would silently orphan values.
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
        message: `A field named "${next.name}" already exists in this pool`,
      });
    throw err;
  }
}

export async function deleteField(fieldId: string) {
  const [row] = await db
    .delete(fieldTable)
    .where(eq(fieldTable.id, fieldId))
    .returning({ id: fieldTable.id });
  if (!row) notFound("Pool field not found");
  return { success: true };
}

// ---- values ------------------------------------------------------------------------

function inferType(value: InputValue): FieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}

// Coerce an input value into the stored string for a field, validated.
export function coerceValue(
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

/**
 * Resolve field names (case-insensitive) to this pool's definitions, creating
 * missing text/number/date/boolean fields when asked.
 */
export async function resolveFields(
  tx: Tx,
  poolId: string,
  values: Record<string, InputValue>,
  createMissing: boolean,
  types: Record<string, FieldType> | undefined,
) {
  const defs = await tx
    .select()
    .from(fieldTable)
    .where(eq(fieldTable.poolId, poolId));
  const byName = new Map(defs.map((d) => [d.name.toLowerCase(), d]));
  const createdFields: ReturnType<typeof serializeField>[] = [];
  const typeFor = (name: string) =>
    Object.entries(types ?? {}).find(
      ([k]) => k.toLowerCase() === name.toLowerCase(),
    )?.[1];
  const resolved: [FieldDef, InputValue][] = [];

  for (const [rawName, value] of Object.entries(values)) {
    const name = rawName.trim();
    if (!name) continue;
    let field = byName.get(name.toLowerCase());
    if (!field) {
      if (isBlankValue(value)) continue;
      if (!createMissing) badRequest(`Unknown pool field "${name}"`);
      const type = typeFor(name) ?? inferType(value);
      if (!AUTO_CREATE_TYPES.has(type)) {
        badRequest(
          `Field "${name}" of type ${type} must be defined (with its options) before values are set`,
        );
      }
      const created =
        (await insertField(tx, poolId, { name, type })) ??
        (
          await tx
            .select()
            .from(fieldTable)
            .where(
              and(
                eq(fieldTable.poolId, poolId),
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
    resolved.push([field, value]);
  }
  return { resolved, createdFields };
}

/** Write resolved values on members (null/blank clears) and touch them. */
export async function writeValues(
  tx: Tx,
  memberIds: string[],
  resolved: [FieldDef, InputValue][],
) {
  if (memberIds.length === 0) return;
  for (const [field, value] of resolved) {
    if (isBlankValue(value)) {
      await tx
        .delete(valueTable)
        .where(
          and(
            eq(valueTable.fieldId, field.id),
            inArray(valueTable.memberId, memberIds),
          ),
        );
      continue;
    }
    const stored = coerceValue(field, value as Exclude<InputValue, null>);
    await tx
      .insert(valueTable)
      .values(
        memberIds.map((memberId) => ({
          memberId,
          fieldId: field.id,
          value: stored,
        })),
      )
      .onConflictDoUpdate({
        target: [valueTable.memberId, valueTable.fieldId],
        set: { value: stored, updatedAt: new Date() },
      });
  }
  // Touch members so pool lists sort by latest activity.
  await tx
    .update(poolMemberTable)
    .set({ updatedAt: new Date() })
    .where(inArray(poolMemberTable.id, memberIds));
}
