import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
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
};

export function CandidatesTable({
  candidates,
  fields,
  isLoading,
  onOpen,
}: CandidatesTableProps) {
  const { t } = useTranslation();
  const muted = "py-3 text-muted-foreground text-sm";

  return (
    <Table>
      <TableHeader>
        <TableRow>
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
          : candidates.map((candidate) => (
              <TableRow
                key={candidate.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onOpen(candidate.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(candidate.id);
                }}
              >
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
