import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import type { ContactPriority } from "@/fetchers/contact/bulk-update-contacts";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

// Contacts share the task priority scale, most urgent first.
export const PRIORITIES: ContactPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "no-priority",
];

export function priorityOptions(): OptionMenuItem[] {
  return PRIORITIES.map((priority) => ({
    value: priority,
    label: getPriorityLabel(priority),
    icon: getPriorityIcon(priority),
  }));
}
