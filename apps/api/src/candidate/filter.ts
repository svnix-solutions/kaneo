// Advanced filters for the candidates list (fork: svnix-solutions/kaneo).
//
// A filter is a list of conditions joined by all/any. Each condition names a
// subject -- a core property, a candidate field ("field:<id>") or a board
// ("board:<projectId>", matched through the candidate's linked tasks) -- an
// operator allowed for that subject's type, and a value.
import { and, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { escapeLikePattern } from "../search/like-pattern";
import {
  candidateFieldDefinitionTable as fieldTable,
  candidateFieldValueTable as valueTable,
  candidateTable,
  taskCandidateTable,
} from "./schema";
import type { FILTER_OPERATORS } from "./request";

export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type FilterValue = string | number | boolean | string[] | null;
export type FilterCondition = {
  field: string;
  op: FilterOperator;
  value?: FilterValue;
};
export type CandidateFilter = {
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
  board: ["any_of", "none_of", "empty", "not_empty"],
};

const CORE_TEXT = {
  name: candidateTable.name,
  phone: candidateTable.phone,
  email: candidateTable.email,
  externalId: candidateTable.externalId,
  source: candidateTable.source,
} as const;
const CORE_DATE = {
  createdAt: candidateTable.createdAt,
  updatedAt: candidateTable.updatedAt,
} as const;

// Mirrors what Number() accepts for stored number values (see coerceValue).
const NUMERIC_RE = "^\\s*-?(\\d+\\.?\\d*|\\.\\d+)([eE][-+]?\\d+)?\\s*$";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Subject = { kind: Kind; label: string; expr: SQL; projectId?: string };

const badRequest = (message: string): never => {
  throw new HTTPException(400, { message });
};

function fieldValueExpr(fieldId: string) {
  return sql`(SELECT ${valueTable.value} FROM ${valueTable} WHERE ${valueTable.candidateId} = ${candidateTable.id} AND ${valueTable.fieldId} = ${fieldId})`;
}

async function resolveSubjects(
  workspaceId: string,
  userId: string,
  conditions: FilterCondition[],
) {
  const fieldIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const { field } of conditions) {
    if (field.startsWith("field:")) fieldIds.add(field.slice(6));
    else if (field.startsWith("board:")) projectIds.add(field.slice(6));
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
            eq(fieldTable.workspaceId, workspaceId),
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
      if (!field)
        return badRequest(`Unknown candidate field in filter: ${key}`);
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
    if (key.startsWith("board:")) {
      const project = byProject.get(key.slice(6));
      if (!project) return badRequest(`Unknown board in filter: ${key}`);
      return {
        kind: "board",
        label: project.name,
        expr: sql``,
        projectId: project.id,
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
    case "board": {
      const onBoard = (columns?: string[]) =>
        sql`EXISTS (SELECT 1 FROM ${taskCandidateTable} INNER JOIN ${taskTable} ON ${taskTable.id} = ${taskCandidateTable.taskId} WHERE ${taskCandidateTable.candidateId} = ${candidateTable.id} AND ${taskTable.projectId} = ${subject.projectId}${
          columns
            ? sql` AND ${taskTable.columnId} = ANY(${textArray(columns)})`
            : sql``
        })`;
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
export async function buildCandidateFilter(
  workspaceId: string,
  userId: string,
  filter: CandidateFilter | undefined,
): Promise<SQL | undefined> {
  const conditions = filter?.conditions ?? [];
  if (conditions.length === 0) return undefined;
  const subjectFor = await resolveSubjects(workspaceId, userId, conditions);
  // coalesce: a NULL from one condition must not turn an "any" match into NULL.
  const parts = conditions.map(
    (c) =>
      sql`coalesce((${conditionSql(subjectFor(c.field), c.op, c.value)}), false)`,
  );
  return filter?.match === "any" ? or(...parts) : and(...parts);
}
