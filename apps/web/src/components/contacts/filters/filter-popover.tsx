import { ListFilter, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { ConditionRow } from "./condition-row";
import {
  type DraftFilter,
  type FilterSubject,
  newCondition,
} from "./filter-model";
import { subjectGroups } from "./subject-groups";

type FilterPopoverProps = {
  subjects: FilterSubject[];
  filter: DraftFilter;
  onChange: (filter: DraftFilter) => void;
  activeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FilterPopover({
  subjects,
  filter,
  onChange,
  activeCount,
  open,
  onOpenChange,
}: FilterPopoverProps) {
  const { t } = useTranslation();
  const { conditions } = filter;

  const add = (subject: FilterSubject) =>
    onChange({ ...filter, conditions: [...conditions, newCondition(subject)] });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", activeCount > 0 && "bg-accent")}
          />
        }
      >
        <ListFilter />
        {t("contacts:filter.button")}
        {activeCount > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-semibold text-[10px] text-background tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(40rem,calc(100vw-2rem))] p-3"
      >
        <div className="flex flex-col gap-3">
          {conditions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("contacts:filter.empty")}
            </p>
          ) : (
            <>
              {conditions.length > 1 ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("contacts:filter.matchPrefix")}</span>
                  <Select
                    value={filter.match}
                    onValueChange={(match) =>
                      match &&
                      onChange({ ...filter, match: match as "all" | "any" })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-auto min-w-20"
                      aria-label={t("contacts:filter.match")}
                    >
                      <SelectValue>
                        {t(`contacts:filter.matchMode.${filter.match}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("contacts:filter.matchMode.all")}
                      </SelectItem>
                      <SelectItem value="any">
                        {t("contacts:filter.matchMode.any")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span>{t("contacts:filter.matchSuffix")}</span>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                {conditions.map((condition) => (
                  <ConditionRow
                    key={condition.id}
                    condition={condition}
                    subjects={subjects}
                    onChange={(next) =>
                      onChange({
                        ...filter,
                        conditions: conditions.map((c) =>
                          c.id === condition.id ? next : c,
                        ),
                      })
                    }
                    onRemove={() =>
                      onChange({
                        ...filter,
                        conditions: conditions.filter(
                          (c) => c.id !== condition.id,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 border-border/80 border-t pt-2">
            <Menu>
              <MenuTrigger
                render={<Button variant="ghost" size="xs" className="gap-1" />}
              >
                <Plus className="size-3" />
                {t("contacts:filter.addCondition")}
              </MenuTrigger>
              <MenuPopup align="start" className="max-h-80 min-w-52">
                {subjectGroups(subjects).map(({ group, items }) => (
                  <MenuGroup key={group}>
                    <MenuGroupLabel>
                      {t(`contacts:filter.groups.${group}`)}
                    </MenuGroupLabel>
                    {items.map((subject) => (
                      <MenuItem key={subject.key} onClick={() => add(subject)}>
                        {subject.label}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                ))}
              </MenuPopup>
            </Menu>
            {conditions.length > 0 ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onChange({ ...filter, conditions: [] })}
              >
                {t("common:actions.clearAll")}
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
