import { ExternalLink } from "lucide-react";
import { CheckboxMark } from "@/components/custom-fields/checkbox-mark";
import { formatCustomFieldValue } from "@/components/custom-fields/format-custom-field-value";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { linkValue } from "./link-value";

/** Read-only cell, formatted like task custom fields on cards. */
export function FieldValue({
  field,
  value,
}: {
  field: CustomFieldDefinition;
  value: string | null | undefined;
}) {
  if (field.type === "boolean") {
    return value === "true" ? <CheckboxMark checked /> : null;
  }
  const link = field.type === "text" ? linkValue(value) : null;
  if (link) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        title={link.href}
        // The row opens the contact; the link should only open itself.
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className="inline-flex max-w-full items-center gap-1 text-foreground underline decoration-muted-foreground/50 underline-offset-2 hover:decoration-current focus-visible:decoration-current"
      >
        <span className="truncate">{link.label}</span>
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </a>
    );
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
