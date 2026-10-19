import type { FilterSubject } from "./filter-model";

const ORDER: FilterSubject["group"][] = ["core", "field", "board"];

/** Subjects split into non-empty groups, in menu order. */
export function subjectGroups(subjects: FilterSubject[]) {
  return ORDER.map((group) => ({
    group,
    items: subjects.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);
}
