import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
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
import type { Candidate } from "@/fetchers/candidate/types";
import { formatDateMedium } from "@/lib/format";
import { CandidateFieldValue } from "./candidate-field-value";

const CORE_COLUMNS = [
  "name",
  "phone",
  "email",
  "externalId",
  "source",
  "updated",
] as const;

type CandidatesTableProps = {
  candidates: Candidate[];
  fields: CustomFieldDefinition[];
  isLoading: boolean;
  onOpen: (candidateId: string) => void;
  /** Omit to hide the selection column. */
  selection?: {
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
  };
};

const stop = (event: { stopPropagation: () => void }) =>
  event.stopPropagation();

export function CandidatesTable({
  candidates,
  fields,
  isLoading,
  onOpen,
  selection,
}: CandidatesTableProps) {
  const { t } = useTranslation();
  const muted = "py-3 text-muted-foreground text-sm";
  const lastClicked = useRef<number | null>(null);
  const selected = selection?.selected ?? new Set<string>();
  const visibleSelected = candidates.filter((c) => selected.has(c.id)).length;
  const allSelected =
    candidates.length > 0 && visibleSelected === candidates.length;

  // Shift-click selects the range from the last clicked row.
  const toggleRow = (index: number, checked: boolean, shiftKey: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    const from =
      shiftKey && lastClicked.current !== null ? lastClicked.current : index;
    const [start, end] = from < index ? [from, index] : [index, from];
    for (const candidate of candidates.slice(start, end + 1)) {
      if (checked) next.add(candidate.id);
      else next.delete(candidate.id);
    }
    lastClicked.current = index;
    selection.onChange(next);
  };

  const toggleAll = () => {
    if (!selection) return;
    selection.onChange(
      allSelected ? new Set() : new Set(candidates.map((c) => c.id)),
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
                disabled={candidates.length === 0}
                onCheckedChange={toggleAll}
                aria-label={t("candidates:bulk.selectAll")}
              />
            </TableHead>
          ) : null}
          {CORE_COLUMNS.map((column) => (
            <TableHead
              key={column}
              className="whitespace-nowrap font-medium text-foreground"
            >
              {t(`candidates:columns.${column}`)}
            </TableHead>
          ))}
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
                {fields.map((field) => (
                  <TableCell key={field.id} className="py-3">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : candidates.map((candidate, index) => (
              <TableRow
                key={candidate.id}
                className="cursor-pointer"
                tabIndex={0}
                data-state={selected.has(candidate.id) ? "selected" : undefined}
                onClick={() => onOpen(candidate.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(candidate.id);
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
                      checked={selected.has(candidate.id)}
                      onCheckedChange={(checked, details) =>
                        toggleRow(
                          index,
                          checked,
                          (details.event as MouseEvent | undefined)?.shiftKey ??
                            false,
                        )
                      }
                      aria-label={t("candidates:bulk.selectOne", {
                        name: candidate.name,
                      })}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="py-3 font-medium">
                  {candidate.name}
                </TableCell>
                <TableCell className={muted}>{candidate.phone}</TableCell>
                <TableCell className={muted}>{candidate.email}</TableCell>
                <TableCell className={`${muted} font-mono`}>
                  {candidate.externalId}
                </TableCell>
                <TableCell className={muted}>{candidate.source}</TableCell>
                <TableCell className={`${muted} whitespace-nowrap`}>
                  {formatDateMedium(candidate.updatedAt)}
                </TableCell>
                {fields.map((field) => (
                  <TableCell key={field.id} className="max-w-48 py-3 text-sm">
                    <CandidateFieldValue
                      field={field}
                      value={candidate.fields[field.id]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
