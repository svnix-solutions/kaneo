import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DraftCondition,
  type FilterOperator,
  type FilterSubject,
  newCondition,
  OPERATORS,
} from "./filter-model";
import { FilterValueInput } from "./filter-value-input";
import { operatorLabel } from "./operator-label";
import { subjectGroups } from "./subject-groups";

type ConditionRowProps = {
  condition: DraftCondition;
  subjects: FilterSubject[];
  onChange: (condition: DraftCondition) => void;
  onRemove: () => void;
};

export function ConditionRow({
  condition,
  subjects,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const { t } = useTranslation();
  const subject = subjects.find((s) => s.key === condition.field);
  if (!subject) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[9.5rem_9.5rem_minmax(0,1fr)_auto]">
      <Select
        value={condition.field}
        onValueChange={(key) => {
          const next = subjects.find((s) => s.key === key);
          if (next) onChange({ ...newCondition(next), id: condition.id });
        }}
      >
        <SelectTrigger
          size="sm"
          className="min-w-0"
          aria-label={t("candidates:filter.subject")}
        >
          <SelectValue>{subject.label}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {subjectGroups(subjects).map(({ group, items }) => (
            <SelectGroup key={group}>
              <SelectGroupLabel>
                {t(`candidates:filter.groups.${group}`)}
              </SelectGroupLabel>
              {items.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.op}
        onValueChange={(op) =>
          op && onChange({ ...condition, op: op as FilterOperator })
        }
      >
        <SelectTrigger
          size="sm"
          className="min-w-0"
          aria-label={t("candidates:filter.operator")}
        >
          <SelectValue>
            {operatorLabel(subject.kind, condition.op, t)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPERATORS[subject.kind].map((op) => (
            <SelectItem key={op} value={op}>
              {operatorLabel(subject.kind, op, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="col-span-3 min-w-0 max-sm:order-last sm:col-span-1">
        <FilterValueInput
          subject={subject}
          condition={condition}
          onChange={(value) => onChange({ ...condition, value })}
        />
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label={t("candidates:filter.removeCondition", {
          name: subject.label,
        })}
      >
        <X />
      </Button>
    </div>
  );
}
