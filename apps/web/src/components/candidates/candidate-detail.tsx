import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomFieldRow } from "@/components/custom-fields/custom-field-row";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SectionHeader } from "@/components/task/sections/section-header";
import { Button } from "@/components/ui/button";
import type { UpdateCandidateRequest } from "@/fetchers/candidate/update-candidate";
import type { Candidate } from "@/fetchers/candidate/types";
import useDeleteCandidate from "@/hooks/mutations/candidate/use-delete-candidate";
import useSetCandidateValues from "@/hooks/mutations/candidate/use-set-candidate-values";
import useUpdateCandidate from "@/hooks/mutations/candidate/use-update-candidate";
import useGetCandidateFields from "@/hooks/queries/candidate/use-get-candidate-fields";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  textField,
  toCustomFieldDefinition,
  toValueInput,
} from "./candidate-field-adapter";
import { CandidateLinkedTasks } from "./candidate-linked-tasks";

const CORE_KEYS = ["name", "phone", "email", "externalId", "source"] as const;
type CoreKey = (typeof CORE_KEYS)[number];

export function CandidateDetail({
  candidate,
  workspaceId,
}: {
  candidate: Candidate;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: rawFields = [] } = useGetCandidateFields(workspaceId);
  const fields = rawFields.map(toCustomFieldDefinition);
  const { mutate: updateCandidate } = useUpdateCandidate();
  const { mutate: setValues } = useSetCandidateValues();
  const { mutateAsync: deleteCandidate, isPending: deleting } =
    useDeleteCandidate();
  const { canUpdateTasks, canDeleteTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canDelete = canDeleteTasks();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saveCore = (key: CoreKey, label: string, value: string) => {
    const trimmed = value.trim();
    const patch: UpdateCandidateRequest = { id: candidate.id };
    if (key === "name") {
      if (!trimmed) return;
      patch.name = trimmed;
    } else {
      patch[key] = trimmed || null;
    }
    updateCandidate(patch, {
      onError: (error) =>
        toast.error(
          errorMessage(
            error,
            t("candidates:detail.saveError", { field: label }),
          ),
        ),
    });
  };

  const handleDelete = async () => {
    try {
      await deleteCandidate(candidate.id);
      toast.success(t("candidates:detail.deleteSuccess"), { icon: Trash2 });
      setConfirmOpen(false);
      navigate({
        to: "/dashboard/workspace/$workspaceId/candidates",
        params: { workspaceId },
      });
    } catch (error) {
      toast.error(errorMessage(error, t("candidates:detail.deleteError")));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-semibold text-xl">{candidate.name}</h1>
          <p className="text-muted-foreground text-xs">
            {t("candidates:detail.addedOn", {
              date: formatDateMedium(candidate.createdAt),
            })}
          </p>
        </div>
        {canDelete ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-destructive-foreground"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-3.5" />
            {t("candidates:detail.delete")}
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-1">
        <SectionHeader title={t("candidates:detail.details")} />
        <div className="flex flex-col">
          {CORE_KEYS.map((key) => {
            const label = t(`candidates:columns.${key}`);
            return (
              <CustomFieldRow
                key={key}
                field={textField(key, label, key === "name")}
                value={candidate[key] ?? ""}
                disabled={!canEdit}
                onChange={(value) => saveCore(key, label, value)}
              />
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <SectionHeader title={t("candidates:detail.fields")} />
        {fields.length === 0 ? (
          <p className="px-2 py-1 text-muted-foreground text-xs">
            {t("candidates:detail.noFields")}
          </p>
        ) : (
          <div className="flex flex-col">
            {fields.map((field) => (
              <CustomFieldRow
                key={field.id}
                field={field}
                value={candidate.fields[field.id] ?? ""}
                disabled={!canEdit}
                onChange={(value) =>
                  setValues(
                    {
                      id: candidate.id,
                      values: { [field.name]: toValueInput(field, value) },
                    },
                    {
                      onError: (error) =>
                        toast.error(
                          errorMessage(
                            error,
                            t("candidates:detail.saveError", {
                              field: field.name,
                            }),
                          ),
                        ),
                    },
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <CandidateLinkedTasks
        candidateId={candidate.id}
        workspaceId={workspaceId}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("candidates:detail.deleteTitle", { name: candidate.name })}
        description={t("candidates:detail.deleteDescription")}
        confirmLabel={t("candidates:detail.delete")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
