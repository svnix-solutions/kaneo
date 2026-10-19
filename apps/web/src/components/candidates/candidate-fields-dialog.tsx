import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { describeCustomField } from "@/components/project/custom-fields/describe-custom-field";
import {
  FIELD_KIND_ICONS,
  toFieldKind,
} from "@/components/project/custom-fields/field-kinds";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsIconTile } from "@/components/settings/settings-icon-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import useDeleteCandidateField from "@/hooks/mutations/candidate/use-delete-candidate-field";
import useGetCandidateFields from "@/hooks/queries/candidate/use-get-candidate-fields";
import { toast } from "@/lib/toast";
import { toCustomFieldDefinition } from "./candidate-field-adapter";
import { CandidateFieldDialog } from "./candidate-field-dialog";
import { fieldErrorMessage } from "./field-error-message";

type CandidateFieldsDialogProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EditorState = {
  open: boolean;
  field: CustomFieldDefinition | null;
  key: number;
};

export function CandidateFieldsDialog({
  workspaceId,
  open,
  onOpenChange,
}: CandidateFieldsDialogProps) {
  const { t, i18n } = useTranslation();
  const { data: rawFields = [] } = useGetCandidateFields(workspaceId);
  const fields = rawFields.map(toCustomFieldDefinition);
  const { mutateAsync: deleteField, isPending: deleting } =
    useDeleteCandidateField(workspaceId);
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    field: null,
    key: 0,
  });
  const [toDelete, setToDelete] = useState<CustomFieldDefinition | null>(null);

  const openEditor = (field: CustomFieldDefinition | null) =>
    setEditor((current) => ({ open: true, field, key: current.key + 1 }));

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteField(toDelete.id);
      toast.success(t("settings:customFields.deleteSuccess"));
      setToDelete(null);
    } catch (error) {
      toast.error(
        fieldErrorMessage(
          error,
          t,
          errorMessage(error, t("settings:customFields.deleteError")),
        ),
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("candidates:fields.title")}</DialogTitle>
            <DialogDescription>
              {t("candidates:fields.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {fields.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("candidates:fields.empty")}
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-lg border">
                {fields.map((field) => {
                  const Icon = FIELD_KIND_ICONS[toFieldKind(field.type)];
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 bg-card px-4 py-3"
                    >
                      <SettingsIconTile>
                        <Icon />
                      </SettingsIconTile>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-medium text-sm">
                            {field.name}
                          </p>
                          {field.required ? (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              {t("settings:customFields.required")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-muted-foreground text-xs">
                          {describeCustomField(field, t, i18n?.language)}
                        </p>
                      </div>
                      <RowActionsMenu
                        label={t("settings:customFields.actionsAria", {
                          name: field.name,
                        })}
                        actions={[
                          {
                            id: "edit",
                            label: t("settings:customFields.edit"),
                            icon: Pencil,
                            onSelect: () => openEditor(field),
                          },
                          {
                            id: "delete",
                            label: t("common:actions.delete"),
                            icon: Trash2,
                            onSelect: () => setToDelete(field),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.close")}
            </Button>
            <Button type="button" onClick={() => openEditor(null)}>
              <Plus aria-hidden="true" />
              {t("candidates:fields.newField")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <CandidateFieldDialog
        key={editor.key}
        workspaceId={workspaceId}
        field={editor.field}
        open={editor.open}
        onOpenChange={(next) =>
          setEditor((current) => ({ ...current, open: next }))
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
        title={t("settings:customFields.deleteTitle", {
          name: toDelete?.name ?? "",
        })}
        description={t("candidates:fields.deleteDescription")}
        confirmLabel={t("settings:customFields.deleteConfirm")}
        pendingLabel={t("settings:customFields.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
