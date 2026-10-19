import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import type { FilterSubject } from "./filter-model";

const CORE_TEXT = ["name", "phone", "email", "externalId", "source"] as const;
const CORE_DATE = [
  ["createdAt", "created"],
  ["updatedAt", "updated"],
] as const;

/** Everything a condition can filter on: properties, fields and boards. */
export function useFilterSubjects(
  workspaceId: string,
  fields: CustomFieldDefinition[],
): FilterSubject[] {
  const { t } = useTranslation();
  const { data: projects } = useGetProjects({ workspaceId });

  return useMemo(
    () => [
      ...CORE_TEXT.map<FilterSubject>((key) => ({
        key,
        label: t(`candidates:columns.${key}`),
        kind: "text",
        group: "core",
      })),
      ...CORE_DATE.map<FilterSubject>(([key, label]) => ({
        key,
        label: t(`candidates:columns.${label}`),
        kind: "date",
        group: "core",
      })),
      ...fields.map<FilterSubject>((field) => ({
        key: `field:${field.id}`,
        label: field.name,
        kind: field.type,
        group: "field",
        options: field.options ?? undefined,
      })),
      ...(projects ?? []).map<FilterSubject>((project) => ({
        key: `board:${project.id}`,
        label: project.name,
        kind: "board",
        group: "board",
        projectId: project.id,
      })),
    ],
    [t, fields, projects],
  );
}
