import { ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { cn } from "@/lib/cn";
import {
  type DraftCondition,
  type FilterSubject,
  takesValue,
} from "./filter-model";

type Option = { value: string; label: string };

type FilterValueInputProps = {
  subject: FilterSubject;
  condition: DraftCondition;
  onChange: (value: string | string[]) => void;
};

export function FilterValueInput({
  subject,
  condition,
  onChange,
}: FilterValueInputProps) {
  const { t } = useTranslation();
  if (!takesValue(condition.op)) return null;
  const value = condition.value;
  const text = Array.isArray(value) ? "" : value;
  const list = Array.isArray(value) ? value : [];

  switch (subject.kind) {
    case "boolean":
      return (
        <Select
          value={text || "true"}
          onValueChange={(next) => next && onChange(String(next))}
        >
          <SelectTrigger
            size="sm"
            className="min-w-0"
            aria-label={t("candidates:filter.value")}
          >
            <SelectValue>
              {text === "false"
                ? t("candidates:filter.unchecked")
                : t("candidates:filter.checked")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">
              {t("candidates:filter.checked")}
            </SelectItem>
            <SelectItem value="false">
              {t("candidates:filter.unchecked")}
            </SelectItem>
          </SelectContent>
        </Select>
      );
    case "dropdown":
    case "multiselect":
      return (
        <OptionsPicker
          options={(subject.options ?? []).map((o) => ({ value: o, label: o }))}
          selected={list}
          onChange={onChange}
        />
      );
    case "board":
      return (
        <BoardColumnsPicker
          projectId={subject.projectId ?? ""}
          selected={list}
          onChange={onChange}
        />
      );
    default:
      return (
        <Input
          size="sm"
          type={
            subject.kind === "number"
              ? "number"
              : subject.kind === "date"
                ? "date"
                : "text"
          }
          inputMode={subject.kind === "number" ? "decimal" : undefined}
          value={text}
          aria-label={t("candidates:filter.value")}
          placeholder={t("candidates:filter.valuePlaceholder")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

function BoardColumnsPicker({
  projectId,
  selected,
  onChange,
}: {
  projectId: string;
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const { data: columns = [] } = useGetColumns(projectId);
  return (
    <OptionsPicker
      options={columns.map((c) => ({ value: c.id, label: c.name }))}
      selected={selected}
      onChange={onChange}
    />
  );
}

function OptionsPicker({
  options,
  selected,
  onChange,
}: {
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  const labels = options
    .filter((o) => selected.includes(o.value))
    .map((o) => o.label);

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={t("candidates:filter.value")}
            className={cn(
              "inline-flex h-7.5 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-background px-2.5 text-left text-sm shadow-xs/5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7 dark:bg-input/32",
              labels.length === 0 && "text-muted-foreground",
            )}
          />
        }
      >
        <span className="truncate">
          {labels.length ? labels.join(", ") : t("candidates:filter.choose")}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-70" />
      </MenuTrigger>
      <MenuPopup align="start" className="max-h-72 min-w-44">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-muted-foreground text-sm">
            {t("candidates:filter.noOptions")}
          </p>
        ) : (
          options.map((option) => (
            <MenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((v) => v !== option.value),
                )
              }
            >
              {option.label}
            </MenuCheckboxItem>
          ))
        )}
      </MenuPopup>
    </Menu>
  );
}
