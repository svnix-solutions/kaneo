import { Link, useNavigate } from "@tanstack/react-router";
import { FolderPlus, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomFieldRow } from "@/components/custom-fields/custom-field-row";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SectionHeader } from "@/components/task/sections/section-header";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { Contact, ContactMembership } from "@/fetchers/contact/types";
import type { UpdateContactRequest } from "@/fetchers/contact/update-contact";
import useDeleteContact from "@/hooks/mutations/contact/use-delete-contact";
import useUpdateContact from "@/hooks/mutations/contact/use-update-contact";
import useRemovePoolMember from "@/hooks/mutations/pool/use-remove-pool-member";
import useUpsertPoolMember from "@/hooks/mutations/pool/use-upsert-pool-member";
import useGetContactPools from "@/hooks/queries/contact/use-get-contact-pools";
import useGetPoolFields from "@/hooks/queries/pool/use-get-pool-fields";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ContactLinkedTasks } from "./contact-linked-tasks";
import {
  textField,
  toCustomFieldDefinition,
  toValueInput,
} from "./field-adapter";

const CORE_KEYS = ["name", "phone", "email", "externalId", "source"] as const;
type CoreKey = (typeof CORE_KEYS)[number];

export function ContactDetail({
  contact,
  workspaceId,
}: {
  contact: Contact;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: memberships = [] } = useGetContactPools(contact.id);
  const { data: pools = [] } = useGetPools(workspaceId);
  const { mutate: updateContact } = useUpdateContact();
  const { mutateAsync: addToPool } = useUpsertPoolMember();
  const { mutateAsync: deleteContact, isPending: deleting } =
    useDeleteContact();
  const { canUpdateTasks, canDeleteTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canDelete = canDeleteTasks();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const joined = new Set(memberships.map((m) => m.pool.id));
  const joinable = pools.filter((p) => !joined.has(p.id));

  const saveCore = (key: CoreKey, label: string, value: string) => {
    const trimmed = value.trim();
    const patch: UpdateContactRequest = { id: contact.id };
    if (key === "name") {
      if (!trimmed) return;
      patch.name = trimmed;
    } else {
      patch[key] = trimmed || null;
    }
    updateContact(patch, {
      onError: (error) =>
        toast.error(
          errorMessage(error, t("contacts:detail.saveError", { field: label })),
        ),
    });
  };

  const join = async (poolId: string, name: string) => {
    try {
      await addToPool({ poolId, contactId: contact.id });
      toast.success(t("contacts:detail.addedToPool", { pool: name }), {
        icon: FolderPlus,
      });
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:bulk.addError")));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteContact(contact.id);
      toast.success(t("contacts:detail.deleteSuccess"), { icon: Trash2 });
      setConfirmOpen(false);
      navigate({
        to: "/dashboard/workspace/$workspaceId/contacts",
        params: { workspaceId },
      });
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:detail.deleteError")));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-semibold text-xl">{contact.name}</h1>
          <p className="text-muted-foreground text-xs">
            {t("contacts:detail.addedOn", {
              date: formatDateMedium(contact.createdAt),
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && joinable.length > 0 ? (
            <Menu>
              <MenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1.5" />
                }
              >
                <FolderPlus className="size-3.5" />
                {t("contacts:bulk.addToPool")}
              </MenuTrigger>
              <MenuPopup align="end" className="min-w-48">
                {joinable.map((pool) => (
                  <MenuItem
                    key={pool.id}
                    onClick={() => void join(pool.id, pool.name)}
                  >
                    {pool.name}
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
          ) : null}
          {canDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive-foreground"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              {t("contacts:detail.delete")}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-1">
        <SectionHeader title={t("contacts:detail.details")} />
        <div className="flex flex-col">
          {CORE_KEYS.map((key) => {
            const label = t(`contacts:columns.${key}`);
            return (
              <CustomFieldRow
                key={key}
                field={textField(key, label, key === "name")}
                value={contact[key] ?? ""}
                disabled={!canEdit}
                onChange={(value) => saveCore(key, label, value)}
              />
            );
          })}
        </div>
      </section>

      {memberships.length === 0 ? (
        <section className="flex flex-col gap-1">
          <SectionHeader title={t("contacts:detail.pools")} />
          <p className="px-2 py-1 text-muted-foreground text-xs">
            {t("contacts:detail.noPools")}
          </p>
        </section>
      ) : (
        memberships.map((membership) => (
          <PoolSection
            key={membership.memberId}
            contactId={contact.id}
            workspaceId={workspaceId}
            membership={membership}
            canEdit={canEdit}
          />
        ))
      )}

      <ContactLinkedTasks contactId={contact.id} workspaceId={workspaceId} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("contacts:detail.deleteTitle", { name: contact.name })}
        description={t("contacts:detail.deleteDescription")}
        confirmLabel={t("contacts:detail.delete")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

/** One pool the contact is in: its fields, editable, and a way out. */
function PoolSection({
  contactId,
  workspaceId,
  membership,
  canEdit,
}: {
  contactId: string;
  workspaceId: string;
  membership: ContactMembership;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { pool } = membership;
  const { data: rawFields = [] } = useGetPoolFields(pool.id);
  const fields = rawFields.map(toCustomFieldDefinition);
  const { mutate: setValues } = useUpsertPoolMember();
  const { mutateAsync: remove, isPending: removing } = useRemovePoolMember();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRemove = async () => {
    try {
      await remove({ poolId: pool.id, contactId });
      toast.success(t("contacts:detail.removedFromPool", { pool: pool.name }), {
        icon: UserMinus,
      });
      setConfirmOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:bulk.removeError")));
    }
  };

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <SectionHeader
          title={
            <Link
              to="/dashboard/workspace/$workspaceId/pools/$poolId"
              params={{ workspaceId, poolId: pool.id }}
              className="hover:underline"
            >
              {pool.name}
            </Link>
          }
        />
        {canEdit ? (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-muted-foreground"
            onClick={() => setConfirmOpen(true)}
          >
            <UserMinus className="size-3" />
            {t("contacts:detail.removeFromPool")}
          </Button>
        ) : null}
      </div>
      {fields.length === 0 ? (
        <p className="px-2 py-1 text-muted-foreground text-xs">
          {t("contacts:poolFields.empty")}
        </p>
      ) : (
        <div className="flex flex-col">
          {fields.map((field) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              value={membership.fields[field.id] ?? ""}
              disabled={!canEdit}
              onChange={(value) =>
                setValues(
                  {
                    poolId: pool.id,
                    contactId,
                    values: { [field.name]: toValueInput(field, value) },
                  },
                  {
                    onError: (error) =>
                      toast.error(
                        errorMessage(
                          error,
                          t("contacts:detail.saveError", { field: field.name }),
                        ),
                      ),
                  },
                )
              }
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("contacts:bulk.removeTitle", { count: 1, pool: pool.name })}
        description={t("contacts:bulk.removeDescription")}
        confirmLabel={t("contacts:bulk.remove")}
        pendingLabel={t("common:actions.deleting")}
        pending={removing}
        onConfirm={() => void handleRemove()}
      />
    </section>
  );
}
