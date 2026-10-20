// Advanced filters for the contacts and pool lists (fork: svnix-solutions/kaneo).
//
// A filter is a list of conditions joined by all/any. Each condition names a
// subject -- a contact property, a field of the pool being listed
// ("field:<id>"), pool membership or target pools ("pools" / "targets",
// contacts list only), priority, or a board
// ("board:<projectId>", matched through the contact's linked tasks) -- an
// operator allowed for that subject's type, and a value.
import { and, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { escapeLikePattern } from "../search/like-pattern";
import {
  contactTable,
  contactTargetPoolTable,
  poolFieldDefinitionTable as fieldTable,
  poolTable,
  poolMemberTable,
  poolFieldValueTable as valueTable,
  taskContactTable,
  taskPoolMemberTable,
} from "./schema";
import type { FILTER_OPERATORS } from "./request";

export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type FilterValue = string | number | boolean | string[] | null;
export type FilterCondition = {
  field: string;
  op: FilterOperator;
  value?: FilterValue;
};
export type ContactFilter = {
  match?: "all" | "any";
  conditions: FilterCondition[];
};

type Kind =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown"
  | "multiselect"
  | "pools"
  | "stage"
  | "board";

export const OPERATORS_BY_KIND: Record<Kind, readonly FilterOperator[]> = {
  text: [
    "contains",
    "not_contains",
    "starts_with",
    "eq",
    "neq",
    "empty",
    "not_empty",
  ],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not_empty"],
  date: ["eq", "gt", "gte", "lt", "lte", "empty", "not_empty"],
  boolean: ["eq"],
  dropdown: ["any_of", "none_of", "empty", "not_empty"],
  multiselect: ["any_of", "all_of", "none_of", "empty", "not_empty"],
  pools: ["any_of", "all_of", "none_of", "empty", "not_empty"],
  // A pool's screening stage: "none" (not on the board), "backlog", or column ids.
  stage: ["any_of", "none_of"],
  board: ["any_of", "none_of", "empty", "not_empty"],
};

/** What is being listed: all contacts, or the members of one pool. */
export type FilterScope = {
  workspaceId: string;
  userId: string;
  poolId?: string;
};

const CORE_TEXT = {
  name: contactTable.name,
  phone: contactTable.phone,
  email: contactTable.email,
  externalId: contactTable.externalId,
  source: contactTable.source,
} as const;
const CORE_DATE = {
  createdAt: contactTable.createdAt,
  updatedAt: contactTable.updatedAt,
} as const;

// Mirrors what Number() accepts for stored number values (see coerceValue).
const NUMERIC_RE = "^\\s*-?(\\d+\\.?\\d*|\\.\\d+)([eE][-+]?\\d+)?\\s*$";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Subject = {
  kind: Kind;
  /** For "pools": membership, or the pools a contact is meant for. */
  link?: typeof poolMemberTable | typeof contactTargetPoolTable;
  label: string;
  expr: SQL;
  projectId?: string;
  poolScoped?: boolean;
};

const badRequest = (message: string): never => {
  throw new HTTPException(400, { message });
};

// Inside a pool query, rows are pool members joined to their contacts.
function fieldValueExpr(fieldId: string) {
  return sql`(SELECT ${valueTable.value} FROM ${valueTable} WHERE ${valueTable.memberId} = ${poolMemberTable.id} AND ${valueTable.fieldId} = ${fieldId})`;
}

async function resolveSubjects(
  { workspaceId, userId, poolId }: FilterScope,
  conditions: FilterCondition[],
) {
  const fieldIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const { field } of conditions) {
    if (field.startsWith("field:")) {
      if (!poolId) badRequest("Pool fields can only be filtered inside a pool");
      fieldIds.add(field.slice(6));
    } else if (field.startsWith("board:")) projectIds.add(field.slice(6));
  }

  const fields = fieldIds.size
    ? await db
        .select({
          id: fieldTable.id,
          name: fieldTable.name,
          type: fieldTable.type,
        })
        .from(fieldTable)
        .where(
          and(
            eq(fieldTable.poolId, poolId ?? ""),
            inArray(fieldTable.id, [...fieldIds]),
          ),
        )
    : [];
  const projects = projectIds.size
    ? await db
        .select({ id: projectTable.id, name: projectTable.name })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            inArray(projectTable.id, [...projectIds]),
          ),
        )
    : [];
  if (projects.length) {
    await assertProjectAccess(
      userId,
      projects.map((p) => p.id),
    );
  }

  const screeningPoolIds = [
    ...new Set(
      conditions
        .map((c) => c.field)
        .filter((f) => f.startsWith("screening:"))
        .map((f) => f.slice(10)),
    ),
  ];
  const screeningPools = screeningPoolIds.length
    ? await db
        .select({
          id: poolTable.id,
          name: poolTable.name,
          screeningProjectId: poolTable.screeningProjectId,
        })
        .from(poolTable)
        .where(
          and(
            eq(poolTable.workspaceId, workspaceId),
            inArray(poolTable.id, screeningPoolIds),
          ),
        )
    : [];
  const byScreening = new Map(screeningPools.map((p) => [p.id, p]));
  const byField = new Map(fields.map((f) => [f.id, f]));
  const byProject = new Map(projects.map((p) => [p.id, p]));

  return (key: string): Subject => {
    if (key in CORE_TEXT) {
      return {
        kind: "text",
        label: key,
        expr: sql`${CORE_TEXT[key as keyof typeof CORE_TEXT]}`,
      };
    }
    if (key in CORE_DATE) {
      return {
        kind: "date",
        label: key,
        expr: sql`to_char(${CORE_DATE[key as keyof typeof CORE_DATE]}, 'YYYY-MM-DD')`,
      };
    }
    if (key.startsWith("field:")) {
      const field = byField.get(key.slice(6));
      if (!field) return badRequest(`Unknown pool field in filter: ${key}`);
      const kind = (
        [
          "text",
          "number",
          "date",
          "boolean",
          "dropdown",
          "multiselect",
        ] as const
      ).find((k) => k === field.type);
      return {
        kind: kind ?? "text",
        label: field.name,
        expr: fieldValueExpr(field.id),
      };
    }
    if (key === "pools" && !poolId) {
      return {
        kind: "pools",
        label: "pools",
        expr: sql``,
        link: poolMemberTable,
      };
    }
    if (key === "targets" && !poolId) {
      return {
        kind: "pools",
        label: "targets",
        expr: sql``,
        link: contactTargetPoolTable,
      };
    }
    if (key === "priority") {
      return {
        kind: "dropdown",
        label: "priority",
        expr: sql`${contactTable.priority}`,
      };
    }
    if (key.startsWith("screening:")) {
      const pool = byScreening.get(key.slice(10));
      if (!pool?.screeningProjectId)
        return badRequest(`No screening board for pool in filter: ${key}`);
      return {
        kind: "stage",
        label: pool.name,
        expr: sql``,
        projectId: pool.screeningProjectId,
      };
    }
    if (key.startsWith("board:")) {
      const project = byProject.get(key.slice(6));
      if (!project) return badRequest(`Unknown board in filter: ${key}`);
      return {
        kind: "board",
        label: project.name,
        expr: sql``,
        projectId: project.id,
        poolScoped: !!poolId,
      };
    }
    return badRequest(`Unknown filter field: ${key}`);
  };
}

function textArray(values: string[]) {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;
}

function readValue(
  subject: Subject,
  op: FilterOperator,
  value: FilterValue | undefined,
) {
  if (op === "empty" || op === "not_empty") return null;
  const invalid = () =>
    badRequest(`Invalid value for "${subject.label}" ${op} filter`);
  switch (subject.kind) {
    case "number": {
      const n =
        typeof value === "string" && value.trim() === ""
          ? Number.NaN
          : Number(value);
      return Number.isFinite(n) &&
        typeof value !== "boolean" &&
        !Array.isArray(value)
        ? String(n)
        : invalid();
    }
    case "date":
      return typeof value === "string" && DAY_RE.test(value.trim())
        ? value.trim()
        : invalid();
    case "boolean":
      if (value === true || value === "true") return "true";
      if (value === false || value === "false") return "false";
      return invalid();
    case "dropdown":
    case "multiselect":
    case "pools":
    case "stage":
    case "board": {
      const list = (Array.isArray(value) ? value : [value])
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
      return list.length ? list : invalid();
    }
    default:
      return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : typeof value === "number"
          ? String(value)
          : invalid();
  }
}

function conditionSql(
  subject: Subject,
  op: FilterOperator,
  raw: FilterValue | undefined,
): SQL {
  if (!OPERATORS_BY_KIND[subject.kind].includes(op)) {
    badRequest(`Operator ${op} does not apply to "${subject.label}"`);
  }
  const v = readValue(subject, op, raw);
  const e = subject.expr;
  const isBlank = sql`(${e} IS NULL OR btrim(${e}) = '')`;

  switch (subject.kind) {
    case "text": {
      // v is null for empty/not_empty.
      const s = (v ?? "") as string;
      const like = escapeLikePattern(s);
      switch (op) {
        case "contains":
          return ilike(e, `%${like}%`);
        case "not_contains":
          return sql`(${e} IS NULL OR ${e} NOT ILIKE ${`%${like}%`})`;
        case "starts_with":
          return ilike(e, `${like}%`);
        case "eq":
          return sql`lower(btrim(${e})) = lower(${s})`;
        case "neq":
          return sql`(${e} IS NULL OR lower(btrim(${e})) <> lower(${s}))`;
        case "empty":
          return isBlank;
        default:
          return sql`NOT ${isBlank}`;
      }
    }
    case "number": {
      const num = sql`(CASE WHEN ${e} ~ ${NUMERIC_RE} THEN btrim(${e})::numeric END)`;
      const n = sql`CAST(${v as string} AS numeric)`;
      switch (op) {
        case "eq":
          return sql`${num} = ${n}`;
        case "neq":
          return sql`(${num} IS NULL OR ${num} <> ${n})`;
        case "gt":
          return sql`${num} > ${n}`;
        case "gte":
          return sql`${num} >= ${n}`;
        case "lt":
          return sql`${num} < ${n}`;
        case "lte":
          return sql`${num} <= ${n}`;
        case "empty":
          return isBlank;
        default:
          return sql`NOT ${isBlank}`;
      }
    }
    case "date": {
      // Stored dates are YYYY-MM-DD or ISO 8601, so the day compares as text.
      const day = sql`left(btrim(${e}), 10)`;
      const d = v as string;
      switch (op) {
        case "eq":
          return sql`${day} = ${d}`;
        case "gt":
          return sql`${day} > ${d}`;
        case "gte":
          return sql`${day} >= ${d}`;
        case "lt":
          return sql`${day} < ${d}`;
        case "lte":
          return sql`${day} <= ${d}`;
        case "empty":
          return isBlank;
        default:
          return sql`NOT ${isBlank}`;
      }
    }
    case "boolean":
      // An unset checkbox reads as unchecked, as it does on the page.
      return v === "true"
        ? sql`${e} = 'true'`
        : sql`coalesce(${e}, '') <> 'true'`;
    case "dropdown": {
      switch (op) {
        case "any_of":
          return sql`${e} = ANY(${textArray(v as string[])})`;
        case "none_of":
          return sql`(${e} IS NULL OR NOT (${e} = ANY(${textArray(v as string[])})))`;
        case "empty":
          return isBlank;
        default:
          return sql`NOT ${isBlank}`;
      }
    }
    case "multiselect": {
      const json = sql`(CASE WHEN ${e} IS JSON ARRAY THEN ${e}::jsonb END)`;
      switch (op) {
        case "any_of":
          return sql`jsonb_exists_any(${json}, ${textArray(v as string[])})`;
        case "all_of":
          return sql`jsonb_exists_all(${json}, ${textArray(v as string[])})`;
        case "none_of":
          return sql`NOT coalesce(jsonb_exists_any(${json}, ${textArray(v as string[])}), false)`;
        case "empty":
          return sql`coalesce(jsonb_array_length(${json}), 0) = 0`;
        default:
          return sql`coalesce(jsonb_array_length(${json}), 0) > 0`;
      }
    }
    case "pools": {
      const link = subject.link ?? poolMemberTable;
      const inPools = (ids?: string[]) =>
        sql`EXISTS (SELECT 1 FROM ${link} WHERE ${link.contactId} = ${contactTable.id}${
          ids ? sql` AND ${link.poolId} = ANY(${textArray(ids)})` : sql``
        })`;
      const ids = v as string[];
      switch (op) {
        case "any_of":
          return inPools(ids);
        case "all_of":
          return sql`(SELECT count(DISTINCT ${link.poolId}) FROM ${link} WHERE ${link.contactId} = ${contactTable.id} AND ${link.poolId} = ANY(${textArray(ids)})) = ${new Set(ids).size}`;
        case "none_of":
          return sql`NOT ${inPools(ids)}`;
        case "empty":
          return sql`NOT ${inPools()}`;
        default:
          return inPools();
      }
    }
    case "stage": {
      // Through the contact's task on the pool's screening board.
      const onBoard = (cond: SQL) =>
        sql`EXISTS (SELECT 1 FROM ${taskTable} INNER JOIN ${taskContactTable} ON ${taskContactTable.taskId} = ${taskTable.id} WHERE ${taskContactTable.contactId} = ${contactTable.id} AND ${taskTable.projectId} = ${subject.projectId} AND ${cond})`;
      const values = v as string[];
      const columns = values.filter((x) => x !== "none" && x !== "backlog");
      const parts: SQL[] = [];
      if (values.includes("none"))
        parts.push(sql`NOT ${onBoard(sql`${taskTable.status} <> 'archived'`)}`);
      if (values.includes("backlog"))
        parts.push(onBoard(sql`${taskTable.status} = 'planned'`));
      if (columns.length)
        parts.push(
          onBoard(
            sql`${taskTable.columnId} = ANY(${textArray(columns)}) AND ${taskTable.status} <> 'planned'`,
          ),
        );
      const any = sql`(${sql.join(parts, sql` OR `)})`;
      return op === "none_of" ? sql`NOT ${any}` : any;
    }
    case "board": {
      // A task on the board linked to the contact, or to the person as a
      // pool member: in a pool list, this pool's member; else any of theirs.
      const memberLink = subject.poolScoped
        ? sql`${taskPoolMemberTable.memberId} = ${poolMemberTable.id}`
        : sql`${taskPoolMemberTable.memberId} IN (SELECT ${poolMemberTable.id} FROM ${poolMemberTable} WHERE ${poolMemberTable.contactId} = ${contactTable.id})`;
      const onBoard = (columns?: string[]) =>
        sql`EXISTS (SELECT 1 FROM ${taskTable} WHERE ${taskTable.projectId} = ${subject.projectId}${
          columns
            ? sql` AND ${taskTable.columnId} = ANY(${textArray(columns)})`
            : sql``
        } AND (EXISTS (SELECT 1 FROM ${taskContactTable} WHERE ${taskContactTable.taskId} = ${taskTable.id} AND ${taskContactTable.contactId} = ${contactTable.id}) OR EXISTS (SELECT 1 FROM ${taskPoolMemberTable} WHERE ${taskPoolMemberTable.taskId} = ${taskTable.id} AND ${memberLink})))`;
      switch (op) {
        case "any_of":
          return onBoard(v as string[]);
        case "none_of":
          return sql`NOT ${onBoard(v as string[])}`;
        case "empty":
          return sql`NOT ${onBoard()}`;
        default:
          return onBoard();
      }
    }
  }
}

/** The WHERE clause for a filter, or undefined when it has no conditions. */
export async function buildContactFilter(
  scope: FilterScope,
  filter: ContactFilter | undefined,
): Promise<SQL | undefined> {
  const conditions = filter?.conditions ?? [];
  if (conditions.length === 0) return undefined;
  const subjectFor = await resolveSubjects(scope, conditions);
  // coalesce: a NULL from one condition must not turn an "any" match into NULL.
  const parts = conditions.map(
    (c) =>
      sql`coalesce((${conditionSql(subjectFor(c.field), c.op, c.value)}), false)`,
  );
  return filter?.match === "any" ? or(...parts) : and(...parts);
}
