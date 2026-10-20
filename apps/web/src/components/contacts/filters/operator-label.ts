import type { FilterKind, FilterOperator } from "./filter-model";

type Translate = (key: string) => string;

// Dates, checkboxes, pools and boards read better with their own wording ("is
// before", "is in stage"); everything else shares the generic labels.
const OVERRIDES: Partial<
  Record<FilterKind, Partial<Record<FilterOperator, string>>>
> = {
  date: {
    eq: "dateEq",
    gt: "dateGt",
    gte: "dateGte",
    lt: "dateLt",
    lte: "dateLte",
  },
  boolean: { eq: "booleanEq" },
  multiselect: { any_of: "hasAnyOf", none_of: "hasNoneOf" },
  pools: {
    any_of: "poolsAnyOf",
    none_of: "poolsNoneOf",
    all_of: "poolsAllOf",
    empty: "poolsEmpty",
    not_empty: "poolsNotEmpty",
  },
  board: {
    any_of: "boardAnyOf",
    none_of: "boardNoneOf",
    empty: "boardEmpty",
    not_empty: "boardNotEmpty",
  },
};

export function operatorLabel(
  kind: FilterKind,
  op: FilterOperator,
  t: Translate,
) {
  return t(`contacts:filter.operators.${OVERRIDES[kind]?.[op] ?? op}`);
}
