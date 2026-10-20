import { describe, expect, it } from "vite-plus/test";
import {
  type DraftCondition,
  type FilterSubject,
  isComplete,
  newCondition,
  toFilterRequest,
} from "./filter-model";

const subjects: FilterSubject[] = [
  { key: "source", label: "Source", kind: "text", group: "core" },
  { key: "field:exp", label: "Experience", kind: "number", group: "field" },
  { key: "field:start", label: "Start", kind: "date", group: "field" },
  { key: "field:skills", label: "Skills", kind: "multiselect", group: "field" },
  { key: "board:p1", label: "Screening", kind: "board", group: "board" },
];
const subject = (key: string) => subjects.find((s) => s.key === key);
const condition = (
  field: string,
  op: DraftCondition["op"],
  value: DraftCondition["value"],
): DraftCondition => ({ id: field + op, field, op, value });

describe("contact filter model", () => {
  it("starts each kind on its first operator with an empty value", () => {
    expect(newCondition(subject("source") as FilterSubject)).toMatchObject({
      op: "contains",
      value: "",
    });
    expect(
      newCondition(subject("field:skills") as FilterSubject),
    ).toMatchObject({ op: "any_of", value: [] });
    expect(newCondition(subject("board:p1") as FilterSubject)).toMatchObject({
      op: "not_empty",
    });
  });

  it("treats a condition as complete only with a usable value", () => {
    expect(isComplete(condition("source", "eq", " "), subject("source"))).toBe(
      false,
    );
    expect(
      isComplete(condition("source", "empty", ""), subject("source")),
    ).toBe(true);
    expect(
      isComplete(condition("field:exp", "gte", "abc"), subject("field:exp")),
    ).toBe(false);
    expect(
      isComplete(
        condition("field:start", "lt", "2026-1-1"),
        subject("field:start"),
      ),
    ).toBe(false);
    expect(
      isComplete(
        condition("field:skills", "any_of", []),
        subject("field:skills"),
      ),
    ).toBe(false);
    // An operator from another kind (left over from a subject change) is invalid.
    expect(
      isComplete(condition("field:exp", "contains", "1"), subject("field:exp")),
    ).toBe(false);
  });

  it("sends only complete conditions, trimmed, without values for empty checks", () => {
    expect(
      toFilterRequest(
        {
          match: "any",
          conditions: [
            condition("source", "eq", "  meta "),
            condition("field:exp", "gte", ""),
            condition("board:p1", "not_empty", []),
            condition("field:skills", "all_of", ["BLS"]),
          ],
        },
        subjects,
      ),
    ).toEqual({
      match: "any",
      conditions: [
        { field: "source", op: "eq", value: "meta" },
        { field: "board:p1", op: "not_empty" },
        { field: "field:skills", op: "all_of", value: ["BLS"] },
      ],
    });
  });
});
