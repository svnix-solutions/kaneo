import { CheckboxMark } from "@/components/custom-fields/checkbox-mark";
import { formatCustomFieldValue } from "@/components/custom-fields/format-custom-field-value";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";

/** Read-only cell, formatted like task custom fields on cards. */
export function CandidateFieldValue({
  field,
  value,
}: {
  field: CustomFieldDefinition;
  value: string | null | undefined;
}) {
  if (field.type === "boolean") {
    return value === "true" ? <CheckboxMark checked /> : null;
  }
  const display = formatCustomFieldValue(field.type, value ?? "", "short");
  if (!display) return null;
  return (
    <span className="truncate" title={display.text}>
      {display.text}
      {display.more ? (
        <span className="ms-1 text-muted-foreground">+{display.more}</span>
      ) : null}
    </span>
  );
}
