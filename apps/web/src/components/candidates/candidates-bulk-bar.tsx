import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { barButtonClass } from "@/components/bulk-selection/bar-button-class";
import { BarTooltip } from "@/components/bulk-selection/bar-tooltip";
import { BulkCountChip } from "@/components/bulk-selection/bulk-count-chip";
import { toolbarPresenceClass } from "@/components/bulk-selection/toolbar-presence-class";
import { useBulkSelectionKeys } from "@/components/bulk-selection/use-bulk-selection-keys";
import { useToolbarPresence } from "@/components/bulk-selection/use-toolbar-presence";
import { errorMessage } from "@/components/project/error-message";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Toolbar } from "@/components/ui/toolbar";
import type { Candidate } from "@/fetchers/candidate/types";
import useBulkDeleteCandidates from "@/hooks/mutations/candidate/use-bulk-delete-candidates";
import useBulkUpdateCandidates from "@/hooks/mutations/candidate/use-bulk-update-candidates";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { toValueInput } from "./candidate-field-adapter";
import { BulkSetFieldPopover, SOURCE_FIELD_ID } from "./bulk-set-field-popover";
import { candidatesToCsv, downloadCsv } from "./export-candidates-csv";

type CandidatesBulkBarProps = {
  workspaceId: string;
  selected: Candidate[];
  fields: CustomFieldDefinition[];
  selectAll: () => void;
  clearSelection: () => void;
};

export function CandidatesBulkBar({
  workspaceId,
  selected,
  fields,
  selectAll,
  clearSelection,
}: CandidatesBulkBarProps) {
  const { t } = useTranslation();
  const { mounted, hidden, displayCount } = useToolbarPresence(selected.length);
  useBulkSelectionKeys({ selectAll, clearSelection });
  const { canUpdateTasks, canDeleteTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canDelete = canDeleteTasks();
  const { mutateAsync: bulkUpdate } = useBulkUpdateCandidates();
  const { mutateAsync: bulkDelete, isPending: deleting } =
    useBulkDeleteCandidates();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ids = selected.map((c) => c.id);

  if (!mounted) return null;

  const setField = async (field: CustomFieldDefinition, value: string) => {
    try {
      const { updated } = await bulkUpdate(
        field.id === SOURCE_FIELD_ID
          ? { workspaceId, ids, source: value.trim() || null }
          : {
              workspaceId,
              ids,
              values: { [field.name]: toValueInput(field, value) },
            },
      );
      toast.success(t("candidates:bulk.updated", { count: updated }));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("candidates:bulk.updateError", { field: field.name }),
        ),
      );
    }
  };

  const exportCsv = () => {
    const csv = candidatesToCsv(selected, fields, {
      name: t("candidates:columns.name"),
      phone: t("candidates:columns.phone"),
      email: t("candidates:columns.email"),
      externalId: t("candidates:columns.externalId"),
      source: t("candidates:columns.source"),
      createdAt: t("candidates:columns.created"),
      updatedAt: t("candidates:columns.updated"),
    });
    downloadCsv(csv, `candidates-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const confirmDelete = async () => {
    try {
      const { deleted } = await bulkDelete({ workspaceId, ids });
      setConfirmOpen(false);
      clearSelection();
      toast.success(t("candidates:bulk.deleted", { count: deleted }), {
        icon: Trash2,
      });
    } catch (error) {
      toast.error(errorMessage(error, t("candidates:bulk.deleteError")));
    }
  };

  const exportLabel = t("candidates:bulk.export");
  const deleteLabel = t("candidates:bulk.delete");

  return (
    <div
      inert={hidden}
      className={cn(
        "-translate-x-1/2 fixed bottom-6 left-1/2 z-50 transition-[translate,opacity,visibility] ease-out max-sm:right-4 max-sm:left-4 max-sm:translate-x-0",
        toolbarPresenceClass(hidden),
      )}
    >
      <Toolbar className="h-10 items-center gap-0.5 rounded-xl border-border/80 bg-popover px-1.5 py-0 shadow-lg/8 max-sm:h-12 max-sm:justify-between">
        <BulkCountChip count={displayCount} onClear={clearSelection} />
        <div className="ms-1.5 flex items-center gap-0.5">
          {canEdit && (
            <BulkSetFieldPopover
              fields={fields}
              onApply={(field, value) => void setField(field, value)}
            />
          )}
          <BarTooltip label={exportLabel}>
            <button
              type="button"
              onClick={exportCsv}
              className={barButtonClass}
            >
              <Download />
              <span className="max-lg:sr-only">{exportLabel}</span>
            </button>
          </BarTooltip>
          {canDelete && (
            <BarTooltip label={deleteLabel}>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className={cn(barButtonClass, "text-destructive-foreground")}
              >
                <Trash2 />
                <span className="max-lg:sr-only">{deleteLabel}</span>
              </button>
            </BarTooltip>
          )}
        </div>
      </Toolbar>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("candidates:bulk.deleteTitle", { count: ids.length })}
        description={t("candidates:bulk.deleteDescription")}
        confirmLabel={t("common:actions.delete")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
