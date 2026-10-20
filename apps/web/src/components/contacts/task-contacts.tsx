import { Link } from "@tanstack/react-router";
import { Contact as ContactIcon, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionAddButton } from "@/components/task/sections/section-add-button";
import { SectionHeader } from "@/components/task/sections/section-header";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import type { Contact } from "@/fetchers/contact/types";
import useLinkContactTask from "@/hooks/mutations/contact/use-link-contact-task";
import useUnlinkContactTask from "@/hooks/mutations/contact/use-unlink-contact-task";
import useQueryContacts from "@/hooks/queries/contact/use-query-contacts";
import useGetTaskContacts from "@/hooks/queries/contact/use-get-task-contacts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type TaskContactsProps = {
  taskId: string;
  workspaceId: string;
};

/** Contacts linked to a task, with a server-searched picker (fork). */
export default function TaskContacts({
  taskId,
  workspaceId,
}: TaskContactsProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);
  const { data: linked = [] } = useGetTaskContacts(taskId);
  const { data: results, isFetching } = useQueryContacts(
    pickerOpen ? workspaceId : "",
    search,
  );
  const { mutateAsync: link } = useLinkContactTask();
  const { mutate: unlink } = useUnlinkContactTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  useEffect(() => {
    if (!pickerOpen) setQuery("");
  }, [pickerOpen]);

  const linkedIds = new Set(linked.map((contact) => contact.id));
  const pickable = (results?.items ?? []).filter(
    (contact) => !linkedIds.has(contact.id),
  );

  const handleLink = async (contactId: string) => {
    try {
      await link({ contactId, taskId });
      setPickerOpen(false);
    } catch {
      toast.error(t("contacts:task.linkError"));
    }
  };

  const handleUnlink = (contactId: string) =>
    unlink(
      { contactId, taskId },
      { onError: () => toast.error(t("contacts:task.unlinkError")) },
    );

  return (
    <>
      <section className="flex flex-col gap-1">
        <SectionHeader
          title={t("contacts:task.title")}
          meta={
            linked.length > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {linked.length}
              </span>
            )
          }
          action={
            canEdit && (
              <SectionAddButton
                aria-label={t("contacts:task.linkAria")}
                onClick={() => setPickerOpen(true)}
              />
            )
          }
        />
        <div className="flex flex-col">
          {linked.map((contact) => (
            <div key={contact.id} className={sectionRowClass}>
              <Link
                to="/dashboard/workspace/$workspaceId/contacts/$contactId"
                params={{ workspaceId, contactId: contact.id }}
                aria-label={`${t("contacts:task.open")}: ${contact.name}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 outline-none"
              >
                <ContactIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate text-[13px]">
                  {contact.name}
                </span>
                {contact.phone ? (
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {contact.phone}
                  </span>
                ) : null}
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  aria-label={t("contacts:task.unlink")}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => handleUnlink(contact.id)}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
          {linked.length === 0 && (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              {t("contacts:task.empty")}
            </p>
          )}
        </div>
      </section>

      <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <CommandDialogPopup>
          <Command items={pickable} filter={null}>
            <CommandInput
              placeholder={t("contacts:task.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <CommandPanel>
              <CommandEmpty>
                {isFetching ? null : (
                  <div className="py-6 text-center">
                    <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">
                      {t("contacts:task.noResults")}
                    </p>
                  </div>
                )}
              </CommandEmpty>
              <CommandList>
                {(contact: Contact) => (
                  <CommandItem
                    key={contact.id}
                    value={contact.id}
                    onClick={() => void handleLink(contact.id)}
                    className="flex items-center gap-3 py-2"
                  >
                    <ContactIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">
                      {contact.name}
                    </span>
                    {contact.phone || contact.email ? (
                      <span className="shrink-0 text-muted-foreground text-xs">
                        {contact.phone ?? contact.email}
                      </span>
                    ) : null}
                  </CommandItem>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <span className="text-muted-foreground/60">
                {t("contacts:task.selectHint")}
              </span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
