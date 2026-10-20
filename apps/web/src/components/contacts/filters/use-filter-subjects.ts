import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import type { FilterSubject } from "./filter-model";
import { priorityOptions } from "../priority";

const NO_FIELDS: CustomFieldDefinition[] = [];

const CORE_TEXT = ["name", "phone", "email", "externalId", "source"] as const;
const CORE_DATE = [
  ["createdAt", "created"],
  ["updatedAt", "updated"],
] as const;

/**
 * Everything a condition can filter on: contact properties, boards, and either
 * pool membership (Contacts page) or the pool's fields (a pool page).
 */
export function useFilterSubjects(
  workspaceId: string,
  scope:
    | {
        fields: CustomFieldDefinition[];
        pool?: { id: string; name: string; screeningProjectId: string | null };
      }
    | { pools: true },
): FilterSubject[] {
  const { t } = useTranslation();
  const { data: projects } = useGetProjects({ workspaceId });
  const withPools = "pools" in scope;
  const fields = "fields" in scope ? scope.fields : NO_FIELDS;
  const { data: pools } = useGetPools(withPools ? workspaceId : "");

  return useMemo(
    () => [
      ...CORE_TEXT.map<FilterSubject>((key) => ({
        key,
        label: t(`contacts:columns.${key}`),
        kind: "text",
        group: "core",
      })),
      {
        key: "priority",
        label: t("contacts:columns.priority"),
        kind: "dropdown",
        group: "core",
        options: priorityOptions().map(({ value, label }) => ({
          value,
          label,
        })),
      } satisfies FilterSubject,
      ...CORE_DATE.map<FilterSubject>(([key, label]) => ({
        key,
        label: t(`contacts:columns.${label}`),
        kind: "date",
        group: "core",
      })),
      ...(withPools
        ? [
            {
              key: "pools",
              label: t("contacts:columns.pools"),
              kind: "pools",
              group: "pools",
              options: (pools ?? []).map((pool) => ({
                value: pool.id,
                label: pool.name,
              })),
            } satisfies FilterSubject,
            {
              key: "targets",
              label: t("contacts:columns.targetPools"),
              kind: "pools",
              group: "pools",
              options: (pools ?? []).map((pool) => ({
                value: pool.id,
                label: pool.name,
              })),
            } satisfies FilterSubject,
          ]
        : []),
      // Screening stage per pool: every pool with a board on the Contacts
      // page, this pool on a pool page.
      ...("pool" in scope && scope.pool
        ? [scope.pool]
        : withPools
          ? (pools ?? [])
          : []
      )
        .filter((pool) => pool.screeningProjectId)
        .map<FilterSubject>((pool) => ({
          key: `screening:${pool.id}`,
          label: t("contacts:filter.screeningOf", { pool: pool.name }),
          kind: "stage",
          group: "pools",
          projectId: pool.screeningProjectId ?? undefined,
        })),
      ...fields.map<FilterSubject>((field) => ({
        key: `field:${field.id}`,
        label: field.name,
        kind: field.type,
        group: "field",
        options: field.options?.map((option) => ({
          value: option,
          label: option,
        })),
      })),
      ...(projects ?? []).map<FilterSubject>((project) => ({
        key: `board:${project.id}`,
        label: project.name,
        kind: "board",
        group: "board",
        projectId: project.id,
      })),
    ],
    [t, fields, projects, pools, withPools, scope],
  );
}
