import { Download, FolderPlus, Kanban, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { barButtonClass } from "@/components/bulk-selection/bar-button-class";
import { BarTooltip } from "@/components/bulk-selection/bar-tooltip";
import { BulkCountChip } from "@/components/bulk-selection/bulk-count-chip";
import { BulkOptionPopover } from "@/components/bulk-selection/bulk-option-popover";
import { toolbarPresenceClass } from "@/components/bulk-selection/toolbar-presence-class";
import { useBulkSelectionKeys } from "@/components/bulk-selection/use-bulk-selection-keys";
import { useToolbarPresence } from "@/components/bulk-selection/use-toolbar-presence";
import { AddToBoardPopover } from "@/components/pools/add-to-board-popover";
import { errorMessage } from "@/components/project/error-message";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Toolbar } from "@/components/ui/toolbar";
import useBulkDeleteContacts from "@/hooks/mutations/contact/use-bulk-delete-contacts";
import useBulkUpdateContacts from "@/hooks/mutations/contact/use-bulk-update-contacts";
import useBulkAddPoolMembers from "@/hooks/mutations/pool/use-bulk-add-pool-members";
import useBulkRemovePoolMembers from "@/hooks/mutations/pool/use-bulk-remove-pool-members";
import useBulkUpdatePoolMembers from "@/hooks/mutations/pool/use-bulk-update-pool-members";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { BulkSetFieldPopover, SOURCE_FIELD_ID } from "./bulk-set-field-popover";
import type { ContactRow } from "./contact-row";
import { contactsToCsv, downloadCsv } from "./export-contacts-csv";
import { toValueInput } from "./field-adapter";

type BulkBarProps = {
  workspaceId: string;
  selected: ContactRow[];
  /** On a pool page: the pool, whose fields can be set and members removed. */
  pool?: { id: string; name: string };
  fields?: CustomFieldDefinition[];
  selectAll: () => void;
  clearSelection: () => void;
};

type Confirm = "delete" | "remove" | null;

export function BulkBar({
  workspaceId,
  selected,
  pool,
  fields = [],
  selectAll,
  clearSelection,
}: BulkBarProps) {
  const { t } = useTranslation();
  const { mounted, hidden, displayCount } = useToolbarPresence(selected.length);
  useBulkSelectionKeys({ selectAll, clearSelection });
  const { canCreateTasks, canUpdateTasks, canDeleteTasks } =
    useWorkspacePermission();
  const canEdit = canUpdateTasks();
  // Deleting a contact removes the person everywhere; only offered on Contacts.
  const canDelete = canDeleteTasks() && !pool;
  const { data: pools = [] } = useGetPools(workspaceId);
  const { mutateAsync: updateContacts } = useBulkUpdateContacts();
  const { mutateAsync: updateMembers } = useBulkUpdatePoolMembers();
  const { mutateAsync: addMembers } = useBulkAddPoolMembers();
  const { mutateAsync: removeMembers, isPending: removing } =
    useBulkRemovePoolMembers();
  const { mutateAsync: deleteContacts, isPending: deleting } =
    useBulkDeleteContacts();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const ids = selected.map((c) => c.id);

  if (!mounted) return null;

  const run = async (
    action: () => Promise<string>,
    failure: string,
    icon?: typeof Trash2,
  ) => {
    try {
      toast.success(await action(), icon ? { icon } : undefined);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, failure));
      return false;
    }
  };

  const setField = (field: CustomFieldDefinition, value: string) =>
    run(
      async () => {
        const { updated } =
          field.id === SOURCE_FIELD_ID
            ? await updateContacts({
                workspaceId,
                ids,
                source: value.trim() || null,
              })
            : await updateMembers({
                poolId: pool?.id ?? "",
                ids,
                values: { [field.name]: toValueInput(field, value) },
              });
        return t("contacts:bulk.updated", { count: updated });
      },
      t("contacts:bulk.updateError", { field: field.name }),
    );

  const addToPool = (poolId: string) => {
    const target = pools.find((p) => p.id === poolId);
    return run(async () => {
      const { added } = await addMembers({ poolId, ids });
      return t("contacts:bulk.added", {
        count: added,
        pool: target?.name ?? "",
      });
    }, t("contacts:bulk.addError"));
  };

  const confirmAction = async () => {
    let done = false;
    if (confirm === "remove" && pool) {
      done = await run(
        async () => {
          const { removed } = await removeMembers({ poolId: pool.id, ids });
          return t("contacts:bulk.removed", {
            count: removed,
            pool: pool.name,
          });
        },
        t("contacts:bulk.removeError"),
        UserMinus,
      );
    } else if (confirm === "delete") {
      done = await run(
        async () => {
          const { deleted } = await deleteContacts({ workspaceId, ids });
          return t("contacts:bulk.deleted", { count: deleted });
        },
        t("contacts:bulk.deleteError"),
        Trash2,
      );
    }
    setConfirm(null);
    if (done) clearSelection();
  };

  const exportCsv = () => {
    const csv = contactsToCsv(selected, fields, {
      name: t("contacts:columns.name"),
      phone: t("contacts:columns.phone"),
      email: t("contacts:columns.email"),
      externalId: t("contacts:columns.externalId"),
      source: t("contacts:columns.source"),
      createdAt: t("contacts:columns.created"),
      updatedAt: t("contacts:columns.updated"),
      ...(pool ? {} : { pools: t("contacts:columns.pools") }),
    });
    const name = pool
      ? pool.name.toLowerCase().replace(/\W+/g, "-")
      : "contacts";
    downloadCsv(csv, `${name}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const otherPools = pools
    .filter((p) => p.id !== pool?.id)
    .map((p) => ({ value: p.id, label: p.name }));
  const exportLabel = t("contacts:bulk.export");
  const boardLabel = t("contacts:pipelines.addToBoard");
  const removeLabel = t("contacts:bulk.remove");
  const deleteLabel = t("contacts:bulk.delete");

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
          {canEdit && otherPools.length > 0 && (
            <BulkOptionPopover
              icon={<FolderPlus />}
              label={t("contacts:bulk.addToPool")}
              placeholder={t("contacts:bulk.poolPlaceholder")}
              options={otherPools}
              onSelect={(poolId) => void addToPool(poolId)}
            />
          )}
          {pool && canCreateTasks() && (
            <AddToBoardPopover
              workspaceId={workspaceId}
              poolId={pool.id}
              ids={ids}
              side="top"
              trigger={
                <button type="button" className={barButtonClass}>
                  <Kanban />
                  <span className="max-lg:sr-only">{boardLabel}</span>
                </button>
              }
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
          {canEdit && pool && (
            <BarTooltip label={removeLabel}>
              <button
                type="button"
                onClick={() => setConfirm("remove")}
                className={cn(barButtonClass, "text-destructive-foreground")}
              >
                <UserMinus />
                <span className="max-lg:sr-only">{removeLabel}</span>
              </button>
            </BarTooltip>
          )}
          {canDelete && (
            <BarTooltip label={deleteLabel}>
              <button
                type="button"
                onClick={() => setConfirm("delete")}
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
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === "remove"
            ? t("contacts:bulk.removeTitle", {
                count: ids.length,
                pool: pool?.name ?? "",
              })
            : t("contacts:bulk.deleteTitle", { count: ids.length })
        }
        description={
          confirm === "remove"
            ? t("contacts:bulk.removeDescription")
            : t("contacts:bulk.deleteDescription")
        }
        confirmLabel={confirm === "remove" ? removeLabel : deleteLabel}
        pendingLabel={t("common:actions.deleting")}
        pending={removing || deleting}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}
