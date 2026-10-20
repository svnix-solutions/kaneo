// Contact and pool list filters: the draft the builder edits and its API request.
// Operators per kind mirror apps/api/src/contact/filter.ts.
import type {
  ContactFilterCondition,
  ContactFilterRequest,
} from "@/fetchers/contact/query-contacts";

export type FilterOperator = ContactFilterCondition["op"];
export type FilterKind =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown"
  | "multiselect"
  | "pools"
  | "stage"
  | "board";

export type FilterSubject = {
  /** API field key: a core property, "field:<id>" or "board:<projectId>". */
  key: string;
  label: string;
  kind: FilterKind;
  group: "core" | "field" | "pools" | "board";
  /** Choices for dropdown/multiselect fields and pools (boards load their columns). */
  options?: { value: string; label: string }[];
  projectId?: string;
};

export type DraftCondition = {
  id: string;
  field: string;
  op: FilterOperator;
  value: string | string[];
};

export type DraftFilter = {
  match: "all" | "any";
  conditions: DraftCondition[];
};

export const EMPTY_FILTER: DraftFilter = { match: "all", conditions: [] };

export const OPERATORS: Record<FilterKind, FilterOperator[]> = {
  text: [
    "contains",
    "not_contains",
    "eq",
    "neq",
    "starts_with",
    "empty",
    "not_empty",
  ],
  number: ["gte", "lte", "gt", "lt", "eq", "neq", "empty", "not_empty"],
  date: ["gte", "lte", "eq", "gt", "lt", "empty", "not_empty"],
  boolean: ["eq"],
  dropdown: ["any_of", "none_of", "empty", "not_empty"],
  multiselect: ["any_of", "all_of", "none_of", "empty", "not_empty"],
  pools: ["any_of", "none_of", "all_of", "empty", "not_empty"],
  stage: ["any_of", "none_of"],
  board: ["not_empty", "any_of", "none_of", "empty"],
};

const NO_VALUE: FilterOperator[] = ["empty", "not_empty"];
const LIST_KINDS: FilterKind[] = [
  "dropdown",
  "multiselect",
  "pools",
  "stage",
  "board",
];

export const takesValue = (op: FilterOperator) => !NO_VALUE.includes(op);
export const takesList = (kind: FilterKind) => LIST_KINDS.includes(kind);

export function newCondition(subject: FilterSubject): DraftCondition {
  return {
    id: Math.random().toString(36).slice(2),
    field: subject.key,
    op: OPERATORS[subject.kind][0] as FilterOperator,
    value:
      subject.kind === "boolean" ? "true" : takesList(subject.kind) ? [] : "",
  };
}

export function isComplete(
  condition: DraftCondition,
  subject: FilterSubject | undefined,
): boolean {
  if (!subject || !OPERATORS[subject.kind].includes(condition.op)) return false;
  if (!takesValue(condition.op)) return true;
  const { value } = condition;
  if (Array.isArray(value)) return value.length > 0;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (subject.kind === "number") return Number.isFinite(Number(trimmed));
  if (subject.kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  return true;
}

/** The request for the complete conditions; incomplete rows are skipped. */
export function toFilterRequest(
  filter: DraftFilter,
  subjects: FilterSubject[],
): ContactFilterRequest {
  const byKey = new Map(subjects.map((s) => [s.key, s]));
  return {
    match: filter.match,
    conditions: filter.conditions
      .filter((c) => isComplete(c, byKey.get(c.field)))
      .map((c) => ({
        field: c.field,
        op: c.op,
        ...(takesValue(c.op)
          ? { value: Array.isArray(c.value) ? c.value : c.value.trim() }
          : {}),
      })),
  };
}
