import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateMedium } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import type { ContactRow } from "./contact-row";
import { FieldValue } from "./field-value";

const CORE_COLUMNS = [
  "name",
  "priority",
  "phone",
  "email",
  "externalId",
  "source",
  "updated",
] as const;

type ContactsTableProps = {
  contacts: ContactRow[];
  /** Pool field columns (pool pages). */
  fields?: CustomFieldDefinition[];
  /** Show which pools each contact is in (Contacts page). */
  showPools?: boolean;
  /** Show each member's pipeline tasks (pool pages); links need the workspace. */
  showPipelines?: boolean;
  workspaceId: string;
  isLoading: boolean;
  onOpen: (contactId: string) => void;
  /** Omit to hide the selection column. */
  selection?: {
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
  };
};

const stop = (event: { stopPropagation: () => void }) =>
  event.stopPropagation();

export function ContactsTable({
  contacts,
  fields = [],
  showPools = false,
  showPipelines = false,
  workspaceId,
  isLoading,
  onOpen,
  selection,
}: ContactsTableProps) {
  const { t } = useTranslation();
  const muted = "py-3 text-muted-foreground text-sm";
  const lastClicked = useRef<number | null>(null);
  const selected = selection?.selected ?? new Set<string>();
  const visibleSelected = contacts.filter((c) => selected.has(c.id)).length;
  const allSelected =
    contacts.length > 0 && visibleSelected === contacts.length;

  // Shift-click selects the range from the last clicked row.
  const toggleRow = (index: number, checked: boolean, shiftKey: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    const from =
      shiftKey && lastClicked.current !== null ? lastClicked.current : index;
    const [start, end] = from < index ? [from, index] : [index, from];
    for (const contact of contacts.slice(start, end + 1)) {
      if (checked) next.add(contact.id);
      else next.delete(contact.id);
    }
    lastClicked.current = index;
    selection.onChange(next);
  };

  const toggleAll = () => {
    if (!selection) return;
    selection.onChange(
      allSelected ? new Set() : new Set(contacts.map((c) => c.id)),
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selection ? (
            <TableHead className="w-10 ps-4">
              <Checkbox
                checked={allSelected}
                indeterminate={visibleSelected > 0 && !allSelected}
                disabled={contacts.length === 0}
                onCheckedChange={toggleAll}
                aria-label={t("contacts:bulk.selectAll")}
              />
            </TableHead>
          ) : null}
          {CORE_COLUMNS.map((column) => (
            <TableHead
              key={column}
              className="whitespace-nowrap font-medium text-foreground"
            >
              {t(`contacts:columns.${column}`)}
            </TableHead>
          ))}
          {showPools ? (
            <>
              <TableHead className="whitespace-nowrap font-medium text-foreground">
                {t("contacts:columns.targetPools")}
              </TableHead>
              <TableHead className="whitespace-nowrap font-medium text-foreground">
                {t("contacts:columns.pools")}
              </TableHead>
            </>
          ) : null}
          {showPipelines ? (
            <TableHead className="whitespace-nowrap font-medium text-foreground">
              {t("contacts:columns.pipelines")}
            </TableHead>
          ) : null}
          {fields.map((field) => (
            <TableHead
              key={field.id}
              className="whitespace-nowrap font-medium text-foreground"
            >
              {field.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? [1, 2, 3].map((row) => (
              <TableRow key={row}>
                {selection ? <TableCell className="w-10 ps-4" /> : null}
                {CORE_COLUMNS.map((column) => (
                  <TableCell key={column} className="py-3">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
                {showPools ? (
                  <TableCell className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ) : null}
                {showPools || showPipelines ? (
                  <TableCell className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ) : null}
                {fields.map((field) => (
                  <TableCell key={field.id} className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : contacts.map((contact, index) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                tabIndex={0}
                data-state={selected.has(contact.id) ? "selected" : undefined}
                onClick={() => onOpen(contact.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(contact.id);
                }}
              >
                {selection ? (
                  <TableCell
                    className="w-10 ps-4"
                    onClick={stop}
                    onKeyDown={stop}
                    // Shift-click selects a range; keep it from selecting text.
                    onMouseDown={(event) => {
                      if (event.shiftKey) event.preventDefault();
                    }}
                  >
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={(checked, details) =>
                        toggleRow(
                          index,
                          checked,
                          (details.event as MouseEvent | undefined)?.shiftKey ??
                            false,
                        )
                      }
                      aria-label={t("contacts:bulk.selectOne", {
                        name: contact.name,
                      })}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="py-3 font-medium">
                  {contact.name}
                </TableCell>
                <TableCell className={muted}>
                  {contact.priority && contact.priority !== "no-priority" ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      {getPriorityIcon(contact.priority)}
                      {getPriorityLabel(contact.priority)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className={muted}>{contact.phone}</TableCell>
                <TableCell className={muted}>{contact.email}</TableCell>
                <TableCell className={`${muted} font-mono`}>
                  {contact.externalId}
                </TableCell>
                <TableCell className={muted}>{contact.source}</TableCell>
                <TableCell className={`${muted} whitespace-nowrap`}>
                  {formatDateMedium(contact.updatedAt)}
                </TableCell>
                {showPools ? (
                  <TableCell className="py-3">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {(contact.targetPools ?? []).map((pool) => (
                        <Badge
                          key={pool.id}
                          variant="outline"
                          className="border-dashed text-muted-foreground"
                        >
                          {pool.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                ) : null}
                {showPools ? (
                  <TableCell className="py-3">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {(contact.pools ?? []).map((pool) => (
                        <Badge key={pool.id} variant="outline">
                          {pool.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                ) : null}
                {showPipelines ? (
                  <TableCell className="py-3">
                    <div className="flex max-w-72 flex-wrap gap-1">
                      {(contact.pipelines ?? []).map((pipeline) => (
                        <Link
                          key={pipeline.taskId}
                          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                          params={{
                            workspaceId,
                            projectId: pipeline.projectId,
                            taskId: pipeline.taskId,
                          }}
                          onClick={stop}
                          onKeyDown={stop}
                          title={`${pipeline.projectName} · ${pipeline.columnName ?? ""}`}
                        >
                          <Badge
                            variant={pipeline.isFinal ? "secondary" : "outline"}
                            className="max-w-56 hover:bg-accent"
                          >
                            <span className="truncate">
                              {pipeline.projectName}
                              {pipeline.columnName
                                ? ` · ${pipeline.columnName}`
                                : ""}
                            </span>
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                ) : null}
                {fields.map((field) => (
                  <TableCell key={field.id} className="max-w-48 py-3 text-sm">
                    <FieldValue
                      field={field}
                      value={contact.fields?.[field.id]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
