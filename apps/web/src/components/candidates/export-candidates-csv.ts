import { parseMultiselect } from "@/components/custom-fields/parse-multiselect";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import type { Candidate } from "@/fetchers/candidate/types";

type CoreKey = "name" | "phone" | "email" | "externalId" | "source";
const CORE: CoreKey[] = ["name", "phone", "email", "externalId", "source"];

function cell(value: string | null | undefined) {
  const text = value ?? "";
  // Neutralise anything a spreadsheet would run as a formula; a leading +/-
  // is left alone on phone numbers and plain numbers.
  const formula =
    /^[=@\t\r]/.test(text) ||
    (/^[+-]/.test(text) && !/^[+-][\d\s().-]*$/.test(text));
  const safe = formula ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function candidatesToCsv(
  candidates: Candidate[],
  fields: CustomFieldDefinition[],
  headers: Record<CoreKey | "createdAt" | "updatedAt", string>,
) {
  const head = [
    ...CORE.map((key) => headers[key]),
    headers.createdAt,
    headers.updatedAt,
    ...fields.map((field) => field.name),
  ];
  const rows = candidates.map((candidate) => [
    ...CORE.map((key) => candidate[key]),
    candidate.createdAt,
    candidate.updatedAt,
    ...fields.map((field) => {
      const value = candidate.fields[field.id];
      return field.type === "multiselect"
        ? parseMultiselect(value).join("; ")
        : value;
    }),
  ]);
  // BOM so Excel reads UTF-8 names correctly.
  return `﻿${[head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}`;
}

export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
