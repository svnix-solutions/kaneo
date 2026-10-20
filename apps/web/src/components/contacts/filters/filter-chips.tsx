import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCustomFieldValue } from "@/components/custom-fields/format-custom-field-value";
import { Button } from "@/components/ui/button";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import {
  type DraftCondition,
  type DraftFilter,
  type FilterSubject,
  isComplete,
  takesValue,
} from "./filter-model";
import { operatorLabel } from "./operator-label";

type FilterChipsProps = {
  subjects: FilterSubject[];
  filter: DraftFilter;
  onChange: (filter: DraftFilter) => void;
  onEdit: () => void;
};

/** One chip per applied condition; click to edit, x to remove. */
export function FilterChips({
  subjects,
  filter,
  onChange,
  onEdit,
}: FilterChipsProps) {
  const { t } = useTranslation();
  const applied = filter.conditions
    .map((condition) => ({
      condition,
      subject: subjects.find((s) => s.key === condition.field),
    }))
    .filter(
      (c): c is { condition: DraftCondition; subject: FilterSubject } =>
        !!c.subject && isComplete(c.condition, c.subject),
    );
  if (applied.length === 0) return null;

  return (
    <section
      aria-label={t("contacts:filter.applied")}
      className="flex flex-wrap items-center gap-1.5 px-4"
    >
      {applied.length > 1 ? (
        <span className="text-muted-foreground text-xs">
          {t(`contacts:filter.matchChip.${filter.match}`)}
        </span>
      ) : null}
      {applied.map(({ condition, subject }) => (
        <div
          key={condition.id}
          className="inline-flex h-7 max-w-full items-stretch overflow-hidden rounded-md border border-border bg-background text-xs shadow-xs/5 *:border-border *:not-last:border-r dark:bg-input/32"
        >
          <button
            type="button"
            onClick={onEdit}
            className="flex min-w-0 items-center gap-1 px-2 outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <span className="shrink-0 text-muted-foreground">
              {subject.label}
            </span>
            <span className="shrink-0">
              {operatorLabel(subject.kind, condition.op, t)}
            </span>
            {takesValue(condition.op) ? (
              <span className="truncate font-medium">
                <ChipValue subject={subject} condition={condition} />
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filter,
                conditions: filter.conditions.filter(
                  (c) => c.id !== condition.id,
                ),
              })
            }
            aria-label={t("contacts:filter.removeCondition", {
              name: subject.label,
            })}
            className="inline-flex w-7 shrink-0 items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="xs"
        className="h-7"
        onClick={() => onChange({ ...filter, conditions: [] })}
      >
        {t("common:actions.clearAll")}
      </Button>
    </section>
  );
}

function ChipValue({
  subject,
  condition,
}: {
  subject: FilterSubject;
  condition: DraftCondition;
}) {
  const { t } = useTranslation();
  const onBoard = subject.kind === "board" || subject.kind === "stage";
  const { data: columns = [] } = useGetColumns(
    onBoard ? (subject.projectId ?? "") : "",
  );
  const { value } = condition;
  if (Array.isArray(value)) {
    const queue: Record<string, string> = {
      none: t("contacts:poolState.not_queued"),
      backlog: t("contacts:poolState.backlog"),
    };
    return onBoard
      ? value
          .map(
            (v) =>
              (subject.kind === "stage" ? queue[v] : undefined) ??
              columns.find((c) => c.id === v)?.name ??
              v,
          )
          .join(", ")
      : value
          .map((v) => subject.options?.find((o) => o.value === v)?.label ?? v)
          .join(", ");
  }
  if (subject.kind === "boolean") {
    return value === "true"
      ? t("contacts:filter.checked")
      : t("contacts:filter.unchecked");
  }
  if (subject.kind === "date") {
    return formatCustomFieldValue("date", value, "medium")?.text ?? value;
  }
  return value;
}
