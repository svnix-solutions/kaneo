import { ChevronLeft, PenLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { barButtonClass } from "@/components/bulk-selection/bar-button-class";
import { BarTooltip } from "@/components/bulk-selection/bar-tooltip";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { DateFieldEditor } from "@/components/custom-fields/date-field-editor";
import { OptionFieldEditor } from "@/components/custom-fields/option-field-editor";
import { TextFieldEditor } from "@/components/custom-fields/text-field-editor";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { textField } from "./field-adapter";

export const SOURCE_FIELD_ID = "__source";

type BulkSetFieldPopoverProps = {
  fields: CustomFieldDefinition[];
  /** Stored string for the field; "" clears it. */
  onApply: (field: CustomFieldDefinition, value: string) => void;
};

export function BulkSetFieldPopover({
  fields,
  onApply,
}: BulkSetFieldPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<CustomFieldDefinition | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const label = t("contacts:bulk.setField");
  const choices = [
    textField(SOURCE_FIELD_ID, t("contacts:columns.source")),
    ...fields,
  ];

  const apply = (value: string) => {
    if (!field) return;
    setOpen(false);
    onApply(field, value);
  };

  const editor = () => {
    if (!field) return null;
    switch (field.type) {
      case "date":
        return <DateFieldEditor value="" required={false} onSelect={apply} />;
      case "boolean":
        return (
          <OptionMenu
            label={field.name}
            placeholder={field.name}
            options={[
              { value: "true", label: t("contacts:filter.checked") },
              { value: "false", label: t("contacts:filter.unchecked") },
            ]}
            onSelect={apply}
          />
        );
      case "dropdown":
        return (
          <OptionFieldEditor
            field={field}
            selected={[]}
            onToggle={apply}
            onClear={() => apply("")}
          />
        );
      case "multiselect":
        return (
          <div>
            <OptionFieldEditor
              field={field}
              selected={picked}
              onToggle={(option) =>
                setPicked((current) =>
                  current.includes(option)
                    ? current.filter((v) => v !== option)
                    : [...current, option],
                )
              }
              onClear={() => apply("")}
            />
            <div className="flex justify-end border-border/80 border-t px-2 py-1.5">
              <Button size="xs" onClick={() => apply(JSON.stringify(picked))}>
                {t("contacts:bulk.apply")}
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <TextFieldEditor
            field={field}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={() => apply(draft.trim())}
          />
        );
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setField(null);
          setDraft("");
          setPicked([]);
        }
      }}
    >
      <BarTooltip label={label}>
        <PopoverTrigger
          render={<button type="button" className={barButtonClass} />}
        >
          <PenLine />
          <span className="max-lg:sr-only">{label}</span>
        </PopoverTrigger>
      </BarTooltip>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto min-w-60 p-0"
      >
        {field ? (
          <div>
            <button
              type="button"
              onClick={() => setField(null)}
              className="flex w-full items-center gap-1 border-border/80 border-b px-2 py-1.5 text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              {t("contacts:bulk.setFieldTo", { field: field.name })}
            </button>
            {editor()}
          </div>
        ) : (
          <OptionMenu
            label={label}
            placeholder={t("contacts:bulk.fieldPlaceholder")}
            options={choices.map((c) => ({ value: c.id, label: c.name }))}
            onSelect={(id) =>
              setField(choices.find((c) => c.id === id) ?? null)
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
